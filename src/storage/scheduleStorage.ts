import { scheduleSeed } from "../data/schedule.seed";
import type { ScheduleEntry } from "../types";

const STORAGE_KEY = "um-tt-schedule-v2";
/** One-time wipe so the board can be re-imported cleanly. */
const WIPE_KEY = "um-tt-schedule-wipe-20260813a";

function isScheduleEntry(value: unknown): value is ScheduleEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.facultyCode === "string" &&
    typeof row.modOffCode === "string" &&
    typeof row.moduleCode === "string" &&
    typeof row.day === "string" &&
    typeof row.slot === "string" &&
    typeof row.startTime === "string" &&
    typeof row.endTime === "string"
  );
}

export function loadSchedule(): ScheduleEntry[] {
  try {
    if (!localStorage.getItem(WIPE_KEY)) {
      localStorage.setItem(WIPE_KEY, "1");
      saveSchedule([]);
      localStorage.setItem("um-tt-cancelled-schedule-v1", "[]");
      return [];
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveSchedule(scheduleSeed);
      return structuredClone(scheduleSeed);
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isScheduleEntry)) {
      saveSchedule(scheduleSeed);
      return structuredClone(scheduleSeed);
    }
    return parsed;
  } catch {
    saveSchedule(scheduleSeed);
    return structuredClone(scheduleSeed);
  }
}

export function saveSchedule(entries: ScheduleEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function clearSchedule(): ScheduleEntry[] {
  saveSchedule([]);
  return [];
}

export function scheduleToCsv(entries: ScheduleEntry[]): string {
  const header = [
    "Faculty",
    "Offering",
    "Module",
    "Occurrence",
    "Activity",
    "Lecturer",
    "Room",
    "Day",
    "Start",
    "End",
    "Weeks",
    "AcademicYear",
    "Period",
  ];
  const lines = entries.map((row) =>
    [
      row.facultyCode,
      row.modOffCode,
      row.moduleCode,
      row.occurrence,
      row.activityCode,
      row.lecturer,
      row.roomCode,
      row.day,
      row.startTime,
      row.endTime,
      row.weeks,
      row.academicYear,
      row.periodSlot,
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
