import type { CancelledScheduleRecord } from "../types";

const STORAGE_KEY = "um-tt-cancelled-schedule-v1";

function isCancelledRecord(value: unknown): value is CancelledScheduleRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const entry = row.entry as Record<string, unknown> | undefined;
  return (
    typeof row.cancelId === "string" &&
    typeof row.cancelledAt === "string" &&
    typeof row.cancelledBy === "string" &&
    typeof row.reason === "string" &&
    !!entry &&
    typeof entry.id === "string" &&
    typeof entry.modOffCode === "string" &&
    typeof entry.day === "string" &&
    typeof entry.slot === "string"
  );
}

export function loadCancelledSchedule(): CancelledScheduleRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isCancelledRecord)) {
      saveCancelledSchedule([]);
      return [];
    }
    return parsed;
  } catch {
    saveCancelledSchedule([]);
    return [];
  }
}

export function saveCancelledSchedule(records: CancelledScheduleRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
