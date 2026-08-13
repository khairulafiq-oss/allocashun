import type { ScheduleConstraint, TimeWindow } from "../types";

function w(start: string, end: string): TimeWindow {
  return { start, end };
}

/** Default scheduling constraint profiles (Super Admin Constraint tab). */
export const scheduleConstraintsSeed: ScheduleConstraint[] = [
  {
    id: "constraint-ug",
    code: "UG",
    label: "Undergraduate",
    summary:
      "Standard: 08:00–13:00, 14:00–17:00 · Friday: 08:00–12:00, 15:00–17:00",
    enabled: true,
    weekdayWindows: [w("08:00", "13:00"), w("14:00", "17:00")],
    fridayWindows: [w("08:00", "12:00"), w("15:00", "17:00")],
  },
  {
    id: "constraint-pg",
    code: "PG",
    label: "Postgraduate",
    summary:
      "Standard: 08:00–13:00, 14:00–19:00, 20:00–22:00 · Friday: 08:00–12:00, 15:00–19:00, 20:00–22:00",
    enabled: true,
    weekdayWindows: [
      w("08:00", "13:00"),
      w("14:00", "19:00"),
      w("20:00", "22:00"),
    ],
    fridayWindows: [
      w("08:00", "12:00"),
      w("15:00", "19:00"),
      w("20:00", "22:00"),
    ],
  },
  {
    id: "constraint-morning",
    code: "Morning",
    label: "Morning",
    summary: "Standard: 08:00–13:00 · Friday: 08:00–12:00",
    enabled: true,
    weekdayWindows: [w("08:00", "13:00")],
    fridayWindows: [w("08:00", "12:00")],
  },
  {
    id: "constraint-afternoon",
    code: "Afternoon",
    label: "Afternoon",
    summary: "Standard: 14:00–17:00 · Friday: 15:00–17:00",
    enabled: true,
    weekdayWindows: [w("14:00", "17:00")],
    fridayWindows: [w("15:00", "17:00")],
  },
  {
    id: "constraint-evening",
    code: "Evening",
    label: "Evening",
    summary: "Daily: 17:00–19:00, 20:00–22:00",
    enabled: true,
    weekdayWindows: [w("17:00", "19:00"), w("20:00", "22:00")],
    fridayWindows: [],
  },
];
