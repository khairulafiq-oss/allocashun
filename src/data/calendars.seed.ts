import { generateTimeSlots } from "../lib/timeSlots";
import type { AcademicCalendar, TimeRules, TimeSlotRule } from "../types";
import { scheduleConstraintsSeed } from "./constraints.seed";

export const calendarsSeed: AcademicCalendar[] = [
  {
    id: "cal-2026-2027-s1",
    academicYear: "2026/2027",
    semester: "Semester 1",
    semesterStart: "2026-10-05",
    semesterEnd: "2027-02-14",
    teachingWeeksStart: 1,
    teachingWeeksEnd: 14,
    breaks: [
      {
        id: "brk-mid-2627-s1",
        name: "Mid-semester break",
        startDate: "2026-11-23",
        endDate: "2026-11-29",
      },
      {
        id: "brk-end-2627-s1",
        name: "Semester break",
        startDate: "2027-02-15",
        endDate: "2027-03-07",
      },
    ],
    isActive: true,
    notes: "Active timetable cycle for Session 2026/2027 Semester 1.",
  },
  {
    id: "cal-2026-2027-s2",
    academicYear: "2026/2027",
    semester: "Semester 2",
    semesterStart: "2027-03-08",
    semesterEnd: "2027-07-18",
    teachingWeeksStart: 1,
    teachingWeeksEnd: 14,
    breaks: [
      {
        id: "brk-mid-2627-s2",
        name: "Mid-semester break",
        startDate: "2027-05-03",
        endDate: "2027-05-09",
      },
      {
        id: "brk-end-2627-s2",
        name: "Long vacation",
        startDate: "2027-07-19",
        endDate: "2027-09-26",
      },
    ],
    isActive: false,
    notes: "Draft calendar for Session 2026/2027 Semester 2.",
  },
  {
    id: "cal-2025-2026-s1",
    academicYear: "2025/2026",
    semester: "Semester 1",
    semesterStart: "2025-10-06",
    semesterEnd: "2026-02-15",
    teachingWeeksStart: 1,
    teachingWeeksEnd: 14,
    breaks: [
      {
        id: "brk-mid-s1",
        name: "Mid-semester break",
        startDate: "2025-11-24",
        endDate: "2025-11-30",
      },
      {
        id: "brk-end-s1",
        name: "Semester break",
        startDate: "2026-02-16",
        endDate: "2026-03-08",
      },
    ],
    isActive: false,
    notes: "Previous cycle — Session 2025/2026 Semester 1.",
  },
  {
    id: "cal-2025-2026-s2",
    academicYear: "2025/2026",
    semester: "Semester 2",
    semesterStart: "2026-03-09",
    semesterEnd: "2026-07-19",
    teachingWeeksStart: 1,
    teachingWeeksEnd: 14,
    breaks: [
      {
        id: "brk-mid-s2",
        name: "Mid-semester break",
        startDate: "2026-05-04",
        endDate: "2026-05-10",
      },
      {
        id: "brk-end-s2",
        name: "Long vacation",
        startDate: "2026-07-20",
        endDate: "2026-09-27",
      },
    ],
    isActive: false,
    notes: "Previous cycle — Session 2025/2026 Semester 2.",
  },
];

function weekdaySlotRule(): TimeSlotRule {
  const dayStart = "08:00";
  const dayEnd = "23:00";
  const stepMins = 30;
  const minDurationMins = 60;
  return {
    id: "slots-weekday",
    label: "Time slots",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    dayStart,
    dayEnd,
    stepMins,
    minDurationMins,
    slots: generateTimeSlots(dayStart, dayEnd, stepMins, minDurationMins),
  };
}

export const timeRulesSeed: TimeRules = {
  slotRules: [weekdaySlotRule()],
  clashRoom: true,
  clashLecturer: true,
  clashOccurrence: true,
  constraints: structuredClone(scheduleConstraintsSeed),
};
