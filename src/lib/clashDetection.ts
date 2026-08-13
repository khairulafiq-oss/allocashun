import { parseSlotRange } from "./timeSlots";
import { formatWeeks, overlappingWeeks, weeksOverlap } from "./weeks";
import type { ScheduleEntry, TimeRules } from "../types";

export type ClashKind = "room" | "lecturer" | "occurrence";

export type ClashHit = {
  kind: ClashKind;
  againstId: string;
  detail: string;
};

function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const a = parseSlotRange(`${aStart}-${aEnd}`);
  const b = parseSlotRange(`${bStart}-${bEnd}`);
  if (!a || !b) return false;
  return a.start < b.end && a.end > b.start;
}

function sameDay(a: string, b: string): boolean {
  return a.slice(0, 3).toLowerCase() === b.slice(0, 3).toLowerCase();
}

export function findScheduleClashes(
  candidate: Pick<
    ScheduleEntry,
    | "id"
    | "day"
    | "startTime"
    | "endTime"
    | "roomCode"
    | "lecturer"
    | "moduleCode"
    | "occurrence"
    | "modOffCode"
    | "weeks"
  >,
  existing: ScheduleEntry[],
  rules: TimeRules,
  opts?: { stopAtFirst?: boolean },
): ClashHit[] {
  const hits: ClashHit[] = [];
  const stopAtFirst = opts?.stopAtFirst === true;

  for (const row of existing) {
    if (row.id === candidate.id) continue;
    if (!sameDay(row.day, candidate.day)) continue;
    if (
      !timesOverlap(
        candidate.startTime,
        candidate.endTime,
        row.startTime,
        row.endTime,
      )
    ) {
      continue;
    }
    if (!weeksOverlap(candidate.weeks, row.weeks)) continue;

    const weekLabel = formatWeeks(overlappingWeeks(candidate.weeks, row.weeks));

    if (
      rules.clashRoom &&
      candidate.roomCode &&
      row.roomCode &&
      candidate.roomCode.toUpperCase() === row.roomCode.toUpperCase()
    ) {
      hits.push({
        kind: "room",
        againstId: row.id,
        detail: `${row.modOffCode} · ${row.roomCode} · ${row.slot}${weekLabel ? ` · w${weekLabel}` : ""}`,
      });
      if (stopAtFirst) return hits;
    }

    if (
      rules.clashLecturer &&
      candidate.lecturer.trim() &&
      row.lecturer.trim() &&
      candidate.lecturer.trim().toLowerCase() ===
        row.lecturer.trim().toLowerCase()
    ) {
      hits.push({
        kind: "lecturer",
        againstId: row.id,
        detail: `${row.modOffCode} · ${row.lecturer} · ${row.slot}${weekLabel ? ` · w${weekLabel}` : ""}`,
      });
      if (stopAtFirst) return hits;
    }

    if (rules.clashOccurrence) {
      const sameOffering =
        (candidate.modOffCode &&
          row.modOffCode &&
          candidate.modOffCode.toUpperCase() ===
            row.modOffCode.toUpperCase()) ||
        (candidate.moduleCode.toUpperCase() === row.moduleCode.toUpperCase() &&
          candidate.occurrence === row.occurrence);
      if (sameOffering) {
        hits.push({
          kind: "occurrence",
          againstId: row.id,
          detail: `${row.modOffCode} · ${row.activityCode} · ${row.slot}${weekLabel ? ` · w${weekLabel}` : ""}`,
        });
        if (stopAtFirst) return hits;
      }
    }
  }

  return hits;
}
