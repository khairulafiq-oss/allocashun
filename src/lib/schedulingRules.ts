import { parseSlotRange } from "./timeSlots";
import { findConstraint, slotFitsConstraint } from "./scheduleConstraints";
import type { TimeRules } from "../types";

/** True when day + HH:mm-HH:mm pair is in the Super Admin whitelist. */
export function isAllowedScheduleSlot(
  rules: TimeRules,
  day: string,
  start: string,
  end: string,
  constraintId?: string | null,
): boolean {
  const key = `${start}-${end}`;
  const normalizedDay = day.slice(0, 3);
  const inWhitelist = rules.slotRules.some(
    (rule) =>
      rule.days.some(
        (d) => d.slice(0, 3).toLowerCase() === normalizedDay.toLowerCase(),
      ) && rule.slots.includes(key),
  );
  if (!inWhitelist) return false;

  const constraint = findConstraint(rules, constraintId);
  if (!constraint) return true;
  return slotFitsConstraint(constraint, day, start, end);
}

/** Days that currently have at least one allowed slot rule. */
export function getSchedulableDays(rules: TimeRules): string[] {
  const set = new Set<string>();
  for (const rule of rules.slotRules) {
    for (const day of rule.days) set.add(day);
  }
  return Array.from(set);
}

/** Whitelist slots for a day, optionally filtered by constraint. */
export function getSlotsForDay(
  rules: TimeRules,
  day: string,
  constraintId?: string | null,
): string[] {
  const set = new Set<string>();
  const normalizedDay = day.slice(0, 3).toLowerCase();
  for (const rule of rules.slotRules) {
    const match = rule.days.some(
      (d) => d.slice(0, 3).toLowerCase() === normalizedDay,
    );
    if (!match) continue;
    for (const s of rule.slots) set.add(s);
  }
  const constraint = findConstraint(rules, constraintId);
  if (!constraint) return Array.from(set).sort();
  return Array.from(set)
    .filter((slot) => {
      const range = parseSlotRange(slot);
      if (!range) return false;
      const [start, end] = slot.split("-");
      if (!start || !end) return false;
      return slotFitsConstraint(constraint, day, start, end);
    })
    .sort();
}
