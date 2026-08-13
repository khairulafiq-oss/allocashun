import type { AcademicCalendar, CalendarBreak } from "../types";

/** Parse "1-7,9,11-14" into a sorted unique week set. */
export function parseWeeks(input: string): number[] {
  const set = new Set<number>();
  const raw = (input ?? "").trim();
  if (!raw) return [];

  for (const part of raw.split(/[,\s]+/)) {
    if (!part) continue;
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      const from = Math.min(a, b);
      const to = Math.max(a, b);
      for (let w = from; w <= to; w += 1) set.add(w);
      continue;
    }
    const n = Number(part);
    if (Number.isFinite(n) && n > 0) set.add(n);
  }

  return [...set].sort((a, b) => a - b);
}

/** Compact "1,2,3,5,6,9" → "1-3,5-6,9". */
export function formatWeeks(weeks: Iterable<number>): string {
  const list = [...new Set(weeks)].filter((n) => n > 0).sort((a, b) => a - b);
  if (list.length === 0) return "";

  const parts: string[] = [];
  let start = list[0];
  let prev = list[0];
  for (let i = 1; i <= list.length; i += 1) {
    const cur = list[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    parts.push(start === prev ? String(start) : `${start}-${prev}`);
    start = cur;
    prev = cur;
  }
  return parts.join(",");
}

export function weeksOverlap(
  a: string | number[] | undefined,
  b: string | number[] | undefined,
): boolean {
  const left = Array.isArray(a) ? a : parseWeeks(a ?? "");
  const right = Array.isArray(b) ? b : parseWeeks(b ?? "");
  if (left.length === 0 || right.length === 0) return true;
  const set = new Set(left);
  return right.some((w) => set.has(w));
}

export function overlappingWeeks(
  a: string | number[] | undefined,
  b: string | number[] | undefined,
): number[] {
  const left = Array.isArray(a) ? a : parseWeeks(a ?? "");
  const right = new Set(Array.isArray(b) ? b : parseWeeks(b ?? ""));
  return left.filter((w) => right.has(w));
}

export function teachingWeekList(calendar: AcademicCalendar | null | undefined): number[] {
  if (!calendar) return [];
  const start = Math.max(1, calendar.teachingWeeksStart || 1);
  const end = Math.max(start, calendar.teachingWeeksEnd || start);
  const list: number[] = [];
  for (let w = start; w <= end; w += 1) list.push(w);
  return list;
}

/** Inclusive week span from semester start/end (week 1 = start date). */
export function teachingWeekSpanFromDates(
  startDate: string,
  endDate: string,
): { from: number; to: number; count: number } | null {
  const a = parseIsoDate(startDate);
  const b = parseIsoDate(endDate);
  if (!a || !b || b.getTime() < a.getTime()) return null;
  const daysInclusive =
    Math.floor((b.getTime() - a.getTime()) / 86_400_000) + 1;
  const count = Math.max(1, Math.ceil(daysInclusive / 7));
  return { from: 1, to: count, count };
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() <= bEnd.getTime() && aEnd.getTime() >= bStart.getTime();
}

/**
 * Map each teaching week to a 7-day window starting from semesterStart.
 * Week 1 = semesterStart .. +6 days, week 2 = +7 .. +13, etc.
 */
export function teachingWeekDateRanges(
  calendar: AcademicCalendar,
): { week: number; start: Date; end: Date }[] {
  const origin = parseIsoDate(calendar.semesterStart);
  if (!origin) return [];
  return teachingWeekList(calendar).map((week) => {
    const start = addDays(origin, (week - 1) * 7);
    const end = addDays(start, 6);
    return { week, start, end };
  });
}

export function noClassWeeks(calendar: AcademicCalendar | null | undefined): Map<number, string> {
  const map = new Map<number, string>();
  if (!calendar) return map;
  const windows = teachingWeekDateRanges(calendar);
  if (windows.length === 0) return map;

  for (const brk of calendar.breaks ?? []) {
    const bStart = parseIsoDate(brk.startDate);
    const bEnd = parseIsoDate(brk.endDate);
    if (!bStart || !bEnd) continue;
    for (const win of windows) {
      if (rangesOverlap(win.start, win.end, bStart, bEnd)) {
        const existing = map.get(win.week);
        map.set(win.week, existing ? `${existing}; ${brk.name}` : brk.name);
      }
    }
  }
  return map;
}

export function weeksOutsideTeaching(
  selected: number[],
  calendar: AcademicCalendar | null | undefined,
): number[] {
  const allowed = new Set(teachingWeekList(calendar));
  if (allowed.size === 0) return [];
  return selected.filter((w) => !allowed.has(w));
}

export function noClassHits(
  selected: number[],
  calendar: AcademicCalendar | null | undefined,
): { week: number; name: string }[] {
  const blocked = noClassWeeks(calendar);
  if (blocked.size === 0) return [];
  return selected
    .filter((w) => blocked.has(w))
    .map((week) => ({ week, name: blocked.get(week) ?? "" }));
}

export function defaultWeeksPattern(calendar: AcademicCalendar | null | undefined): string {
  const list = teachingWeekList(calendar);
  if (list.length === 0) return "1-14";
  const blocked = noClassWeeks(calendar);
  const usable = list.filter((w) => !blocked.has(w));
  return formatWeeks(usable.length ? usable : list);
}

export function breakLabel(brk: CalendarBreak): string {
  return `${brk.name} (${brk.startDate}–${brk.endDate})`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parse common spreadsheet date strings (ISO, d/m/y, etc.). */
export function parseImportDate(value: string): Date | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const iso = new Date(`${raw}T00:00:00`);
    return Number.isNaN(iso.getTime()) ? null : iso;
  }

  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
    ) {
      return parsed;
    }
  }

  const fallback = new Date(raw);
  if (Number.isNaN(fallback.getTime())) return null;
  return new Date(
    fallback.getFullYear(),
    fallback.getMonth(),
    fallback.getDate(),
  );
}

export function dayFromDate(date: Date): string {
  return DAY_NAMES[date.getDay()] ?? "Mon";
}

export function dateToTeachingWeek(
  date: Date,
  calendar: AcademicCalendar,
): number | null {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  for (const win of teachingWeekDateRanges(calendar)) {
    const start = new Date(
      win.start.getFullYear(),
      win.start.getMonth(),
      win.start.getDate(),
    );
    const end = new Date(
      win.end.getFullYear(),
      win.end.getMonth(),
      win.end.getDate(),
    );
    if (target >= start && target <= end) return win.week;
  }
  return null;
}
