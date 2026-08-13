/** Convert HH:mm to minutes from midnight. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Build whitelist of allowed start-end pairs used during scheduling.
 * Matches UM-style grids: step intervals with a minimum class duration.
 */
export function generateTimeSlots(
  dayStart: string,
  dayEnd: string,
  stepMins: number,
  minDurationMins: number,
): string[] {
  const start = timeToMinutes(dayStart);
  const end = timeToMinutes(dayEnd);
  const step = Math.max(5, stepMins);
  const minDur = Math.max(step, minDurationMins);
  const slots: string[] = [];

  if (end <= start) return slots;

  for (let s = start; s + minDur <= end; s += step) {
    for (let e = s + minDur; e <= end; e += step) {
      slots.push(`${minutesToTime(s)}-${minutesToTime(e)}`);
    }
  }
  return slots;
}

export function formatSlotDayLabel(days: string[]): string {
  return days.map((d) => d.slice(0, 3).toUpperCase()).join(", ");
}

export function parseSlotRange(slot: string): { start: number; end: number } | null {
  const [startRaw, endRaw] = slot.split("-");
  if (!startRaw || !endRaw) return null;
  return { start: timeToMinutes(startRaw), end: timeToMinutes(endRaw) };
}

/** True when slot overlaps [blockStart, blockEnd). */
export function slotOverlapsWindow(
  slot: string,
  blockStart: string,
  blockEnd: string,
): boolean {
  const range = parseSlotRange(slot);
  if (!range) return false;
  const bStart = timeToMinutes(blockStart);
  const bEnd = timeToMinutes(blockEnd);
  if (bEnd <= bStart) return false;
  return range.start < bEnd && range.end > bStart;
}

/** Remove slots that overlap a rest/blackout window (e.g. Jumaat 12:00–15:00). */
export function excludeOverlappingSlots(
  slots: string[],
  blockStart: string,
  blockEnd: string,
): string[] {
  return slots.filter((slot) => !slotOverlapsWindow(slot, blockStart, blockEnd));
}
