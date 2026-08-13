import type { AcademicCalendar, ScheduleEntry } from "../types";

export function semesterToPeriodSlot(semester: string): string {
  const match = semester.match(/(\d+)/);
  if (match) return `S${match[1]}`;
  return semester.replace(/\s+/g, "").toUpperCase();
}

export function academicYearMatches(
  calendarYear: string,
  entryYear: string,
): boolean {
  const cal = calendarYear.trim();
  const ent = entryYear.trim();
  if (!cal || !ent) return false;
  if (cal === ent) return true;
  if (cal.includes(ent) || ent.includes(cal)) return true;
  return cal
    .split("/")
    .map((part) => part.trim())
    .some((part) => part === ent);
}

export function scheduleEntryMatchesCalendar(
  entry: ScheduleEntry,
  calendar: AcademicCalendar,
): boolean {
  const entrySlot = (entry.periodSlot ?? "").trim().toUpperCase();
  const calendarSlot = semesterToPeriodSlot(calendar.semester).toUpperCase();
  const slotMatch =
    entrySlot === calendarSlot ||
    calendar.semester.replace(/\s+/g, "").toUpperCase().includes(entrySlot);

  return (
    academicYearMatches(calendar.academicYear, entry.academicYear) && slotMatch
  );
}

export function scheduleEntryMatchesCalendars(
  entry: ScheduleEntry,
  calendars: AcademicCalendar[],
): boolean {
  if (calendars.length === 0) return false;
  return calendars.some((calendar) =>
    scheduleEntryMatchesCalendar(entry, calendar),
  );
}

export function calendarMatchesImportRow(
  calendar: AcademicCalendar,
  academicYear: string,
  periodSlot: string,
): boolean {
  const entrySlot = periodSlot.trim().toUpperCase();
  const calendarSlot = semesterToPeriodSlot(calendar.semester).toUpperCase();
  const slotMatch =
    entrySlot === calendarSlot ||
    calendar.semester.replace(/\s+/g, "").toUpperCase().includes(entrySlot);
  return academicYearMatches(calendar.academicYear, academicYear) && slotMatch;
}

export function resolveImportCalendar(
  academicYear: string,
  periodSlot: string,
  calendars: AcademicCalendar[],
  preferredCalendars: AcademicCalendar[] = [],
): AcademicCalendar | null {
  const match = (calendar: AcademicCalendar) =>
    calendarMatchesImportRow(calendar, academicYear, periodSlot);

  const preferred = preferredCalendars.find(match);
  if (preferred) return preferred;

  const active = calendars.find((calendar) => calendar.isActive && match(calendar));
  if (active) return active;

  return calendars.find(match) ?? null;
}
