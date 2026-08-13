import { parseSlotRange, timeToMinutes } from "./timeSlots";
import type {
  ScheduleConstraint,
  TimeRules,
  TimeWindow,
} from "../types";
import { scheduleConstraintsSeed } from "../data/constraints.seed";

function isFriday(day: string): boolean {
  return day.slice(0, 3).toLowerCase() === "fri";
}

/** Windows that apply on a given day for this constraint. */
export function windowsForDay(
  constraint: ScheduleConstraint,
  day: string,
): TimeWindow[] {
  if (isFriday(day) && constraint.fridayWindows.length > 0) {
    return constraint.fridayWindows;
  }
  return constraint.weekdayWindows;
}

/** True when HH:mm–HH:mm lies fully inside one allowed window. */
export function slotFitsWindows(
  start: string,
  end: string,
  windows: TimeWindow[],
): boolean {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return false;
  return windows.some((w) => {
    const ws = timeToMinutes(w.start);
    const we = timeToMinutes(w.end);
    return s >= ws && e <= we;
  });
}

export function slotFitsConstraint(
  constraint: ScheduleConstraint,
  day: string,
  start: string,
  end: string,
): boolean {
  if (!constraint.enabled) return false;
  return slotFitsWindows(start, end, windowsForDay(constraint, day));
}

export function findConstraint(
  rules: TimeRules,
  constraintId: string | undefined | null,
  opts?: { requireEnabled?: boolean },
): ScheduleConstraint | undefined {
  if (!constraintId) return undefined;
  const id = constraintId.trim();
  if (!id) return undefined;
  const hit = (rules.constraints ?? []).find(
    (c) => c.id === id || c.code.toUpperCase() === id.toUpperCase(),
  );
  if (!hit) return undefined;
  if (opts?.requireEnabled !== false && !hit.enabled) return undefined;
  return hit;
}

/** Label for Manual/Auto constraint dropdowns. */
export function constraintPickerLabel(constraint: ScheduleConstraint): string {
  const summary = constraint.summary?.trim();
  if (summary) return `${constraint.code} — ${summary}`;
  return `${constraint.code} — ${constraint.label}`;
}

/** Ensure TimeRules always has the five seed constraints (merge by id/code). */
export function ensureConstraints(rules: TimeRules): TimeRules {
  const existing = Array.isArray(rules.constraints) ? rules.constraints : [];
  const byCode = new Map(
    existing.map((c) => [c.code.trim().toUpperCase(), c]),
  );
  const merged: ScheduleConstraint[] = scheduleConstraintsSeed.map((seed) => {
    const hit = byCode.get(seed.code.toUpperCase());
    if (!hit) return structuredClone(seed);
    return {
      ...seed,
      id: hit.id || seed.id,
      code: seed.code,
      // Keep timing copy in sync with seed so pickers stay clear.
      label: seed.label,
      summary: seed.summary,
      weekdayWindows:
        hit.weekdayWindows?.length > 0
          ? hit.weekdayWindows
          : seed.weekdayWindows,
      fridayWindows: hit.fridayWindows ?? seed.fridayWindows,
      enabled: typeof hit.enabled === "boolean" ? hit.enabled : seed.enabled,
    };
  });
  return { ...rules, constraints: merged };
}

/** Filter whitelist slot strings for a day under an optional constraint. */
export function filterSlotsByConstraint(
  slots: string[],
  day: string,
  constraint: ScheduleConstraint | undefined,
): string[] {
  if (!constraint) return slots;
  return slots.filter((slot) => {
    const range = parseSlotRange(slot);
    if (!range) return false;
    const [start, end] = slot.split("-");
    if (!start || !end) return false;
    return slotFitsConstraint(constraint, day, start, end);
  });
}
