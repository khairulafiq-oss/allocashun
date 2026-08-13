import { findScheduleClashes } from "./clashDetection";
import { flattenOfferedTargets } from "./dietPackageImport";
import { isAllowedScheduleSlot } from "./schedulingRules";
import { timeToMinutes } from "./timeSlots";
import type {
  Activity,
  AutoGenerateParams,
  AutoSchedulePattern,
  AutoSlotSpread,
  DietPackagePreview,
  OfferingGroup,
  Room,
  ScheduleEntry,
  TimeRules,
} from "../types";

type SlotCand = { day: string; start: string; end: string; slot: string };

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayKey(day: string): string {
  return day.slice(0, 3);
}

function dayIndex(day: string): number {
  const idx = DAY_ORDER.findIndex(
    (d) => d.toLowerCase() === dayKey(day).toLowerCase(),
  );
  return idx === -1 ? 99 : idx;
}

export type AutoGeneratePlanItem = {
  moduleCode: string;
  occurrence: string;
  capacity: number;
  patternId: string;
  patternLabel: string;
  sessionIndex: number;
  offering?: OfferingGroup;
  status:
    | "ready"
    | "skip_existing"
    | "already_scheduled"
    | "no_slot"
    | "no_room"
    | "no_pattern";
  reason?: string;
  draft?: ScheduleEntry;
};

export type AutoGenerateResult = {
  plan: AutoGeneratePlanItem[];
  created: ScheduleEntry[];
  readyCount: number;
  skipCount: number;
  errorCount: number;
};

function newId(prefix = "auto"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function slotDurationMins(start: string, end: string): number {
  return timeToMinutes(end) - timeToMinutes(start);
}

function listWhitelistSlots(
  rules: TimeRules,
  preferredDays: string[] | null,
  preferredStart: string | null,
  preferredEnd: string | null,
  durationMins: number,
  constraintId?: string | null,
): SlotCand[] {
  const out: SlotCand[] = [];
  const seen = new Set<string>();
  const dayFilter =
    preferredDays && preferredDays.length > 0
      ? new Set(preferredDays.map((d) => d.slice(0, 3).toLowerCase()))
      : null;

  for (const rule of rules.slotRules) {
    for (const day of rule.days) {
      if (dayFilter && !dayFilter.has(day.slice(0, 3).toLowerCase())) {
        continue;
      }
      for (const slot of rule.slots) {
        const [start, end] = slot.split("-");
        if (!start || !end) continue;
        if (slotDurationMins(start, end) !== durationMins) continue;
        if (preferredStart && preferredEnd) {
          if (start !== preferredStart || end !== preferredEnd) continue;
        }
        if (!isAllowedScheduleSlot(rules, day, start, end, constraintId)) {
          continue;
        }
        const key = `${dayKey(day)}|${start}|${end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ day, start, end, slot: `${start}-${end}` });
      }
    }
  }

  out.sort((a, b) => {
    const dayDiff = dayIndex(a.day) - dayIndex(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.start.localeCompare(b.start);
  });
  return out;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function moduleDaysUsed(
  working: ScheduleEntry[],
  moduleCode: string,
  occurrence: string,
): Set<string> {
  const used = new Set<string>();
  const mod = moduleCode.toUpperCase();
  const occ = occurrence.toUpperCase();
  for (const e of working) {
    if (e.moduleCode.toUpperCase() !== mod) continue;
    if ((e.occurrence || "").toUpperCase() !== occ) continue;
    used.add(dayKey(e.day).toLowerCase());
  }
  return used;
}

/**
 * Order whitelist candidates: pattern sequence stays (caller places LEC then TUT).
 * padding = spread days + leave a gap; random = shuffle among Time Rules slots.
 */
function orderCandidates(
  candidates: SlotCand[],
  spread: AutoSlotSpread,
  opts: {
    consecutive: boolean;
    lastPlaced?: SlotCand;
    working: ScheduleEntry[];
    moduleCode: string;
    occurrence: string;
    occOffset: number;
  },
): SlotCand[] {
  if (candidates.length === 0) return [];

  if (opts.consecutive && opts.lastPlaced) {
    const adj = candidates.filter((c) =>
      sameDaySlotsAdjacent(opts.lastPlaced!, c),
    );
    const rest = candidates.filter(
      (c) => !sameDaySlotsAdjacent(opts.lastPlaced!, c),
    );
    return [...adj, ...orderCandidates(rest, spread, { ...opts, consecutive: false, lastPlaced: undefined })];
  }

  if (spread === "random") {
    return shuffle(candidates);
  }

  const usedDays = moduleDaysUsed(
    opts.working,
    opts.moduleCode,
    opts.occurrence,
  );
  const last = opts.lastPlaced;
  const loadByDay = new Map<string, number>();
  for (const e of opts.working) {
    const k = dayKey(e.day).toLowerCase();
    loadByDay.set(k, (loadByDay.get(k) ?? 0) + 1);
  }

  return [...candidates].sort((a, b) => {
    const aDay = dayKey(a.day).toLowerCase();
    const bDay = dayKey(b.day).toLowerCase();
    const aUsed = usedDays.has(aDay) ? 1 : 0;
    const bUsed = usedDays.has(bDay) ? 1 : 0;
    if (aUsed !== bUsed) return aUsed - bUsed;

    const aLoad = loadByDay.get(aDay) ?? 0;
    const bLoad = loadByDay.get(bDay) ?? 0;
    if (aLoad !== bLoad) return aLoad - bLoad;

    const rot = (dayIndex(a.day) - (opts.occOffset % 5) + 7) % 7;
    const rotB = (dayIndex(b.day) - (opts.occOffset % 5) + 7) % 7;
    if (rot !== rotB) return rot - rotB;

    if (last) {
      const lastDay = dayKey(last.day).toLowerCase();
      const aSame = aDay === lastDay ? 1 : 0;
      const bSame = bDay === lastDay ? 1 : 0;
      if (aSame !== bSame) return aSame - bSame;
      const aAdj = sameDaySlotsAdjacent(last, a) ? 1 : 0;
      const bAdj = sameDaySlotsAdjacent(last, b) ? 1 : 0;
      if (aAdj !== bAdj) return aAdj - bAdj;
    }

    return a.start.localeCompare(b.start);
  });
}

function matchOffering(
  offerings: OfferingGroup[],
  moduleCode: string,
  occurrence: string,
  academicYear: string,
  periodSlot: string,
  facultyCode: string,
): OfferingGroup | undefined {
  const mod = moduleCode.toUpperCase();
  const occ = occurrence.toUpperCase();
  const year = academicYear.trim();
  const period = periodSlot.trim();
  const fac = facultyCode.trim().toUpperCase();

  return offerings.find((o) => {
    if (!o.active) return false;
    if (o.moduleCode.toUpperCase() !== mod) return false;
    if ((o.occurrence || "").toUpperCase() !== occ) return false;
    if (fac && o.facultyCode.toUpperCase() !== fac) return false;
    if (year && o.academicYear && o.academicYear !== year) return false;
    if (period && o.periodSlot && o.periodSlot !== period) return false;
    return true;
  });
}

function offeringIndexKey(
  moduleCode: string,
  occurrence: string,
  academicYear: string,
  periodSlot: string,
  facultyCode: string,
): string {
  return [
    moduleCode.trim().toUpperCase(),
    (occurrence || "").trim().toUpperCase(),
    academicYear.trim(),
    periodSlot.trim().toUpperCase(),
    facultyCode.trim().toUpperCase(),
  ].join("|");
}

function buildOfferingIndex(
  offerings: OfferingGroup[],
  academicYear: string,
  periodSlot: string,
  facultyCode: string,
): Map<string, OfferingGroup> {
  const map = new Map<string, OfferingGroup>();
  const year = academicYear.trim();
  const period = periodSlot.trim();
  const fac = facultyCode.trim().toUpperCase();
  for (const o of offerings) {
    if (!o.active) continue;
    if (year && o.academicYear && o.academicYear !== year) continue;
    if (period && o.periodSlot && o.periodSlot !== period) continue;
    if (fac && o.facultyCode.toUpperCase() !== fac) continue;
    const key = offeringIndexKey(
      o.moduleCode,
      o.occurrence,
      year || o.academicYear,
      period || o.periodSlot,
      fac || o.facultyCode,
    );
    if (!map.has(key)) map.set(key, o);
  }
  return map;
}

function lookupOffering(
  index: Map<string, OfferingGroup>,
  offerings: OfferingGroup[],
  moduleCode: string,
  occurrence: string,
  academicYear: string,
  periodSlot: string,
  facultyCode: string,
): OfferingGroup | undefined {
  const key = offeringIndexKey(
    moduleCode,
    occurrence,
    academicYear,
    periodSlot,
    facultyCode,
  );
  return (
    index.get(key) ??
    matchOffering(
      offerings,
      moduleCode,
      occurrence,
      academicYear,
      periodSlot,
      facultyCode,
    )
  );
}

function pickRoom(
  rooms: Room[],
  pattern: AutoSchedulePattern,
  capacity: number,
  facultyCode: string,
  respectCapacity: boolean,
): Room | undefined {
  const active = rooms.filter((r) => r.inUse);
  if (pattern.roomMode === "manual" && pattern.preferredRoomCodes.length > 0) {
    const set = new Set(
      pattern.preferredRoomCodes.map((c) => c.toUpperCase()),
    );
    return active.find((r) => set.has(r.roomCode.toUpperCase()));
  }

  const fac = facultyCode.toUpperCase();
  const facRooms = active.filter(
    (r) => (r.udf01 || "").trim().toUpperCase() === fac,
  );
  const pool = facRooms.length > 0 ? facRooms : active;
  if (respectCapacity && capacity > 0) {
    const fit = pool.find((r) => (r.maximumSeats || 0) >= capacity);
    if (fit) return fit;
  }
  return pool[0];
}

function pickLecturer(
  offering: OfferingGroup | undefined,
  pattern: AutoSchedulePattern,
): string {
  if (pattern.lecturerMode === "manual" && pattern.preferredLecturerIds[0]) {
    return pattern.preferredLecturerIds[0];
  }
  return (offering?.coordinatorId || "").trim();
}

function resolveActivity(
  activities: Activity[],
  activityCode: string,
): { code: string; name: string } {
  const hit = activities.find(
    (a) => a.activityCode.toUpperCase() === activityCode.toUpperCase(),
  );
  return {
    code: activityCode || "LEC",
    name: hit?.activityName || activityCode || "Lecture",
  };
}

function sameDaySlotsAdjacent(
  a: { day: string; start: string; end: string },
  b: { day: string; start: string; end: string },
): boolean {
  return (
    a.day.slice(0, 3).toLowerCase() === b.day.slice(0, 3).toLowerCase() &&
    a.end === b.start
  );
}

/**
 * One pattern = one placement (joint for all selected occurrences).
 * sessionsCount > 1 still means several meetings of that same pattern.
 */
export function runAutoGenerate(input: {
  packagePreview: DietPackagePreview;
  params: AutoGenerateParams;
  offerings: OfferingGroup[];
  rooms: Room[];
  activities: Activity[];
  existing: ScheduleEntry[];
  timeRules: TimeRules;
  apply: boolean;
  /** Modules already on the board for this semester — skip entirely. */
  lockedModuleCodes?: string[];
}): AutoGenerateResult {
  const {
    packagePreview,
    params,
    offerings,
    rooms,
    activities,
    existing,
    timeRules,
    apply,
    lockedModuleCodes = [],
  } = input;

  const targets = flattenOfferedTargets(
    packagePreview,
    params.facultyCode || undefined,
  );
  const patterns = params.patterns.filter((p) => p.moduleCode.trim());
  const locked = new Set(
    lockedModuleCodes.map((c) => c.trim().toUpperCase()).filter(Boolean),
  );
  const offeringIndex = buildOfferingIndex(
    offerings,
    params.academicYear,
    params.periodSlot,
    params.facultyCode,
  );

  const working = [...existing];
  const plan: AutoGeneratePlanItem[] = [];
  const created: ScheduleEntry[] = [];

  if (patterns.length === 0) {
    return {
      plan: [],
      created: [],
      readyCount: 0,
      skipCount: 0,
      errorCount: 0,
    };
  }

  for (const pattern of patterns) {
    const modKey = pattern.moduleCode.trim().toUpperCase();
    if (locked.has(modKey)) {
      plan.push({
        moduleCode: pattern.moduleCode,
        occurrence: pattern.occurrenceCodes.join(",") || "*",
        capacity: 0,
        patternId: pattern.id,
        patternLabel: pattern.label || pattern.activityCode,
        sessionIndex: 1,
        status: "already_scheduled",
        reason: "Module already scheduled this semester",
      });
      continue;
    }
    const occFilter =
      pattern.occurrenceCodes.length > 0
        ? new Set(pattern.occurrenceCodes.map((c) => c.trim().toUpperCase()))
        : null;
    const patternTargets = targets.filter((t) => {
      if (t.moduleCode.toUpperCase() !== modKey) return false;
      if (occFilter && !occFilter.has(t.occurrence.toUpperCase())) return false;
      return true;
    });

    if (patternTargets.length === 0) {
      plan.push({
        moduleCode: pattern.moduleCode,
        occurrence: pattern.occurrenceCodes.join(",") || "*",
        capacity: 0,
        patternId: pattern.id,
        patternLabel: pattern.label || pattern.activityCode,
        sessionIndex: 1,
        status: "no_pattern",
        reason: "No matching module/occurrence in package for this faculty",
      });
      continue;
    }

    const activity = resolveActivity(activities, pattern.activityCode);
    const weekPattern =
      pattern.weekMode === "manual" && pattern.weekPattern.trim()
        ? pattern.weekPattern.trim()
        : "1-14";
    const dayPref =
      pattern.dayMode === "manual" && pattern.preferredDays.length > 0
        ? pattern.preferredDays
        : null;
    const timePref =
      pattern.timeMode === "manual" &&
      pattern.preferredStart &&
      pattern.preferredEnd
        ? { start: pattern.preferredStart, end: pattern.preferredEnd }
        : null;

    const candidateSlots = listWhitelistSlots(
      timeRules,
      dayPref,
      timePref?.start ?? null,
      timePref?.end ?? null,
      pattern.durationMins,
      params.constraintId,
    );

    const sessions = Math.max(1, pattern.sessionsCount || 1);
    const jointCapacity = Math.max(
      ...patternTargets.map((t) => t.capacity || 0),
      0,
    );
    const primary = patternTargets[0];
    const primaryOffering = lookupOffering(
      offeringIndex,
      offerings,
      primary.moduleCode,
      primary.occurrence,
      params.academicYear,
      params.periodSlot,
      params.facultyCode,
    );

    let lastPlaced: SlotCand | undefined;

    for (let sessionIndex = 1; sessionIndex <= sessions; sessionIndex++) {
      const alreadyJoint = patternTargets.every((target) => {
        const existingSame = working.filter(
          (e) =>
            e.moduleCode.toUpperCase() === target.moduleCode.toUpperCase() &&
            (e.occurrence || "").toUpperCase() ===
              target.occurrence.toUpperCase() &&
            e.activityCode.toUpperCase() === activity.code.toUpperCase() &&
            (!params.academicYear || e.academicYear === params.academicYear) &&
            (!params.periodSlot || e.periodSlot === params.periodSlot) &&
            e.weeks === weekPattern,
        );
        return existingSame.length >= sessionIndex;
      });
      if (alreadyJoint) {
        plan.push({
          ...primary,
          occurrence: patternTargets.map((t) => t.occurrence).join(","),
          patternId: pattern.id,
          patternLabel: pattern.label || activity.code,
          sessionIndex,
          offering: primaryOffering,
          status: "skip_existing",
          reason: `Already has ${activity.code} for this pattern`,
        });
        continue;
      }

      const room = pickRoom(
        rooms,
        pattern,
        jointCapacity,
        params.facultyCode || primaryOffering?.facultyCode || "",
        params.respectCapacity,
      );
      if (!room) {
        plan.push({
          ...primary,
          occurrence: patternTargets.map((t) => t.occurrence).join(","),
          patternId: pattern.id,
          patternLabel: pattern.label || activity.code,
          sessionIndex,
          offering: primaryOffering,
          status: "no_room",
          reason: "No room available",
        });
        continue;
      }

      const lecturer = pickLecturer(primaryOffering, pattern);
      let placed: SlotCand | undefined;

      const ordered = orderCandidates(
        candidateSlots,
        params.slotSpread ?? "padding",
        {
          consecutive: pattern.consecutive,
          lastPlaced,
          working,
          moduleCode: primary.moduleCode,
          occurrence: primary.occurrence,
          occOffset: sessionIndex - 1,
        },
      );

      for (const cand of ordered) {
        if (
          !isAllowedScheduleSlot(
            timeRules,
            cand.day,
            cand.start,
            cand.end,
            params.constraintId,
          )
        ) {
          continue;
        }

        const probe: ScheduleEntry = {
          id: newId(),
          facultyCode: params.facultyCode || primaryOffering?.facultyCode || "",
          facultyName: primaryOffering?.facultyName || "",
          offeringId: primaryOffering?.id || "",
          modOffCode:
            primaryOffering?.modOffCode ||
            `${primary.moduleCode}/${params.academicYear || "AY"}/${params.periodSlot || "P"}/${primary.occurrence}`,
          moduleCode: primary.moduleCode,
          moduleName: primaryOffering?.moduleName || "",
          occurrence: primary.occurrence,
          activityCode: activity.code,
          activityName: activity.name,
          roomCode: room.roomCode,
          roomName: room.shortName || room.fullName || "",
          lecturer,
          day: cand.day.slice(0, 3),
          slot: cand.slot,
          startTime: cand.start,
          endTime: cand.end,
          weeks: weekPattern,
          academicYear: params.academicYear || primaryOffering?.academicYear || "",
          periodSlot: params.periodSlot || primaryOffering?.periodSlot || "",
          createdAt: new Date().toISOString(),
        };

        if (!params.allowClashes) {
          const clashes = findScheduleClashes(probe, working, timeRules, {
            stopAtFirst: true,
          });
          if (clashes.length > 0) continue;
        }

        placed = cand;
        lastPlaced = cand;

        for (const target of patternTargets) {
          const offering = lookupOffering(
            offeringIndex,
            offerings,
            target.moduleCode,
            target.occurrence,
            params.academicYear,
            params.periodSlot,
            params.facultyCode,
          );
          const draft: ScheduleEntry = {
            ...probe,
            id: newId(),
            offeringId: offering?.id || "",
            facultyName: offering?.facultyName || probe.facultyName,
            moduleName: offering?.moduleName || probe.moduleName,
            modOffCode:
              offering?.modOffCode ||
              `${target.moduleCode}/${params.academicYear || "AY"}/${params.periodSlot || "P"}/${target.occurrence}`,
            occurrence: target.occurrence,
          };
          plan.push({
            ...target,
            patternId: pattern.id,
            patternLabel: pattern.label || activity.code,
            sessionIndex,
            offering,
            status: "ready",
            draft,
          });
          working.push(draft);
          if (apply) created.push(draft);
        }
        break;
      }

      if (!placed) {
        plan.push({
          ...primary,
          occurrence: patternTargets.map((t) => t.occurrence).join(","),
          patternId: pattern.id,
          patternLabel: pattern.label || activity.code,
          sessionIndex,
          offering: primaryOffering,
          status: "no_slot",
          reason:
            candidateSlots.length === 0
              ? `No ${pattern.durationMins}min whitelist slots match prefs`
              : "No free slot (clashes)",
        });
      }
    }
  }

  return {
    plan,
    created,
    readyCount: plan.filter((p) => p.status === "ready").length,
    skipCount: plan.filter(
      (p) =>
        p.status === "skip_existing" || p.status === "already_scheduled",
    ).length,
    errorCount: plan.filter(
      (p) =>
        p.status === "no_slot" ||
        p.status === "no_room" ||
        p.status === "no_pattern",
    ).length,
  };
}

export function defaultPattern(
  partial?: Partial<AutoSchedulePattern>,
): AutoSchedulePattern {
  const { id: _ignored, ...rest } = partial ?? {};
  return {
    id: partial?.id ?? newId("pat"),
    label: "Lecture",
    moduleCode: "",
    occurrenceCodes: [],
    activityCode: "LEC",
    sessionsCount: 1,
    durationMins: 60,
    weekMode: "auto",
    weekPattern: "1-14",
    dayMode: "auto",
    preferredDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    timeMode: "auto",
    preferredStart: "08:00",
    preferredEnd: "09:00",
    roomMode: "auto",
    preferredRoomCodes: [],
    lecturerMode: "auto",
    preferredLecturerIds: [],
    consecutive: false,
    ...rest,
  };
}

export function defaultAutoParams(): AutoGenerateParams {
  return {
    academicYear: "",
    periodSlot: "",
    facultyCode: "",
    constraintId: "constraint-ug",
    patterns: [],
    slotSpread: "padding",
    respectCapacity: true,
    allowClashes: false,
  };
}
