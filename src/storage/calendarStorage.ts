import { calendarsSeed, timeRulesSeed } from "../data/calendars.seed";
import { ensureConstraints } from "../lib/scheduleConstraints";
import type {
  AcademicCalendar,
  ScheduleConstraint,
  TimeRules,
  TimeSlotRule,
  TimeWindow,
} from "../types";

const CAL_KEY = "um-tt-academic-calendars-v1";
const RULES_KEY = "um-tt-time-rules-v3";

function isBreak(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.startDate === "string" &&
    typeof row.endDate === "string"
  );
}

function isCalendar(value: unknown): value is AcademicCalendar {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.academicYear === "string" &&
    typeof row.semester === "string" &&
    typeof row.semesterStart === "string" &&
    typeof row.semesterEnd === "string" &&
    typeof row.teachingWeeksStart === "number" &&
    typeof row.teachingWeeksEnd === "number" &&
    Array.isArray(row.breaks) &&
    row.breaks.every(isBreak) &&
    typeof row.isActive === "boolean" &&
    typeof row.notes === "string"
  );
}

function isWindow(value: unknown): value is TimeWindow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.start === "string" && typeof row.end === "string";
}

function isConstraint(value: unknown): value is ScheduleConstraint {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.code === "string" &&
    typeof row.label === "string" &&
    typeof row.enabled === "boolean" &&
    Array.isArray(row.weekdayWindows) &&
    row.weekdayWindows.every(isWindow) &&
    Array.isArray(row.fridayWindows) &&
    row.fridayWindows.every(isWindow)
  );
}

function isSlotRule(value: unknown): value is TimeSlotRule {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.label === "string" &&
    Array.isArray(row.days) &&
    Array.isArray(row.slots) &&
    typeof row.dayStart === "string" &&
    typeof row.dayEnd === "string" &&
    typeof row.stepMins === "number" &&
    typeof row.minDurationMins === "number"
  );
}

function isTimeRulesBase(value: unknown): value is Omit<TimeRules, "constraints"> & {
  constraints?: ScheduleConstraint[];
} {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    Array.isArray(row.slotRules) &&
    row.slotRules.every(isSlotRule) &&
    typeof row.clashRoom === "boolean" &&
    typeof row.clashLecturer === "boolean" &&
    typeof row.clashOccurrence === "boolean" &&
    (row.constraints === undefined ||
      (Array.isArray(row.constraints) && row.constraints.every(isConstraint)))
  );
}

function cloneRules(rules: TimeRules): TimeRules {
  return ensureConstraints(structuredClone(rules));
}

function calendarKey(c: AcademicCalendar): string {
  return `${c.academicYear.trim()}|${c.semester.trim()}`.toLowerCase();
}

/** Ensure seed calendars exist in storage (add missing only; keep user edits). */
export function mergeCalendarSeed(
  stored: AcademicCalendar[],
): AcademicCalendar[] {
  const byId = new Set(stored.map((c) => c.id));
  const byKey = new Set(stored.map(calendarKey));
  const extras: AcademicCalendar[] = [];
  for (const seed of calendarsSeed) {
    if (byId.has(seed.id) || byKey.has(calendarKey(seed))) continue;
    extras.push(structuredClone(seed));
  }
  if (extras.length === 0) return stored;
  return [...stored, ...extras];
}

export function loadCalendars(): AcademicCalendar[] {
  try {
    const raw = localStorage.getItem(CAL_KEY);
    if (!raw) {
      saveCalendars(calendarsSeed);
      return structuredClone(calendarsSeed);
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isCalendar)) {
      saveCalendars(calendarsSeed);
      return structuredClone(calendarsSeed);
    }
    const merged = mergeCalendarSeed(parsed);
    if (merged.length !== parsed.length) {
      saveCalendars(merged);
    }
    return merged;
  } catch {
    saveCalendars(calendarsSeed);
    return structuredClone(calendarsSeed);
  }
}

export function saveCalendars(calendars: AcademicCalendar[]): void {
  localStorage.setItem(CAL_KEY, JSON.stringify(calendars));
}

function readLegacyRules(): TimeRules | null {
  try {
    const legacy = localStorage.getItem("um-tt-time-rules-v2");
    if (!legacy) return null;
    const parsed: unknown = JSON.parse(legacy);
    if (!isTimeRulesBase(parsed)) return null;
    return ensureConstraints({
      ...parsed,
      constraints: parsed.constraints ?? [],
    });
  } catch {
    return null;
  }
}

export function loadTimeRules(): TimeRules {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (!raw) {
      const legacy = readLegacyRules();
      const seed = legacy ?? cloneRules(timeRulesSeed);
      saveTimeRules(seed);
      return seed;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isTimeRulesBase(parsed)) {
      const seed = cloneRules(timeRulesSeed);
      saveTimeRules(seed);
      return seed;
    }
    const next = ensureConstraints({
      ...parsed,
      constraints: parsed.constraints ?? [],
    });
    return next;
  } catch {
    const seed = cloneRules(timeRulesSeed);
    saveTimeRules(seed);
    return seed;
  }
}

export function saveTimeRules(rules: TimeRules): void {
  localStorage.setItem(RULES_KEY, JSON.stringify(ensureConstraints(rules)));
}
