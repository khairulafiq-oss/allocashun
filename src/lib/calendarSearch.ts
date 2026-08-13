import type { ScheduleEntry } from "../types";

export type CalendarSearchField =
  | "any"
  | "faculty"
  | "module"
  | "offering"
  | "room"
  | "lecturer"
  | "activity"
  | "day"
  | "weeks"
  | "academicYear"
  | "period";

export type CalendarSearchSuggestion = {
  value: string;
  label: string;
  sub?: string;
  /** Concrete field when searching under "any". */
  field?: CalendarSearchField;
};

export type CalendarCriterion = {
  id: string;
  field: CalendarSearchField;
  value: string;
  label: string;
};

export const CALENDAR_SEARCH_FIELDS: CalendarSearchField[] = [
  "any",
  "faculty",
  "module",
  "offering",
  "room",
  "lecturer",
  "activity",
  "day",
  "weeks",
  "academicYear",
  "period",
];

export function fieldHaystack(
  row: ScheduleEntry,
  field: CalendarSearchField,
): string {
  switch (field) {
    case "faculty":
      return `${row.facultyCode} ${row.facultyName}`;
    case "module":
      return `${row.moduleCode} ${row.moduleName}`;
    case "offering":
      return `${row.modOffCode} ${row.occurrence}`;
    case "room":
      return `${row.roomCode} ${row.roomName}`;
    case "lecturer":
      return row.lecturer ?? "";
    case "activity":
      return `${row.activityCode} ${row.activityName}`;
    case "day":
      return row.day;
    case "weeks":
      return row.weeks ?? "";
    case "academicYear":
      return row.academicYear ?? "";
    case "period":
      return row.periodSlot ?? "";
    case "any":
    default:
      return [
        row.facultyCode,
        row.facultyName,
        row.moduleCode,
        row.moduleName,
        row.modOffCode,
        row.occurrence,
        row.activityCode,
        row.activityName,
        row.roomCode,
        row.roomName,
        row.lecturer,
        row.day,
        row.slot,
        row.weeks,
        row.academicYear,
        row.periodSlot,
      ]
        .filter(Boolean)
        .join(" ");
  }
}

function pushUnique(
  map: Map<string, CalendarSearchSuggestion>,
  suggestion: CalendarSearchSuggestion,
) {
  const key = `${suggestion.field ?? "any"}|${suggestion.value.trim().toLowerCase()}`;
  if (!suggestion.value.trim() || map.has(key)) return;
  map.set(key, suggestion);
}

/** Build Result list after user clicks Search. */
export function searchParameterResults(
  entries: ScheduleEntry[],
  field: CalendarSearchField,
  query: string,
  limit = 200,
): CalendarSearchSuggestion[] {
  const q = query.trim().toLowerCase();
  const map = new Map<string, CalendarSearchSuggestion>();

  for (const row of entries) {
    if (field === "any" || field === "faculty") {
      pushUnique(map, {
        value: row.facultyCode,
        label: row.facultyName
          ? `${row.facultyName}, ${row.facultyCode}`
          : row.facultyCode,
        sub: row.facultyCode,
        field: "faculty",
      });
    }
    if (field === "any" || field === "module") {
      pushUnique(map, {
        value: row.moduleCode,
        label: row.moduleName
          ? `${row.moduleName}, ${row.moduleCode}`
          : row.moduleCode,
        sub: row.moduleCode,
        field: "module",
      });
    }
    if (field === "any" || field === "offering") {
      pushUnique(map, {
        value: row.modOffCode,
        label: row.modOffCode,
        sub: row.moduleCode,
        field: "offering",
      });
    }
    if (field === "any" || field === "room") {
      pushUnique(map, {
        value: row.roomCode,
        label: row.roomName
          ? `${row.roomName}, ${row.roomCode}`
          : row.roomCode,
        sub: row.roomCode,
        field: "room",
      });
    }
    if ((field === "any" || field === "lecturer") && row.lecturer) {
      pushUnique(map, {
        value: row.lecturer,
        label: row.lecturer,
        field: "lecturer",
      });
    }
    if (field === "any" || field === "activity") {
      pushUnique(map, {
        value: row.activityCode,
        label: row.activityName
          ? `${row.activityName}, ${row.activityCode}`
          : row.activityCode,
        sub: row.activityCode,
        field: "activity",
      });
    }
    if (field === "any" || field === "day") {
      pushUnique(map, { value: row.day, label: row.day, field: "day" });
    }
    if ((field === "any" || field === "weeks") && row.weeks) {
      pushUnique(map, {
        value: row.weeks,
        label: row.weeks,
        field: "weeks",
      });
    }
    if ((field === "any" || field === "academicYear") && row.academicYear) {
      pushUnique(map, {
        value: row.academicYear,
        label: row.academicYear,
        field: "academicYear",
      });
    }
    if ((field === "any" || field === "period") && row.periodSlot) {
      pushUnique(map, {
        value: row.periodSlot,
        label: row.periodSlot,
        field: "period",
      });
    }
  }

  let list = [...map.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );

  if (q) {
    list = list.filter((item) => {
      const hay = `${item.value} ${item.label} ${item.sub ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  return list.slice(0, limit);
}

/**
 * Same parameter values are OR'd (2 faculties → both appear).
 * Different parameters are AND'd (Faculty A + Module X → only that intersection).
 */
export function filterScheduleByCriteria(
  entries: ScheduleEntry[],
  criteria: CalendarCriterion[],
): ScheduleEntry[] {
  if (criteria.length === 0) return [];

  const byField = new Map<CalendarSearchField, string[]>();
  for (const c of criteria) {
    const value = c.value.trim().toLowerCase();
    if (!value) continue;
    const list = byField.get(c.field) ?? [];
    if (!list.includes(value)) list.push(value);
    byField.set(c.field, list);
  }

  if (byField.size === 0) return [];

  return entries.filter((row) => {
    for (const [field, values] of byField) {
      if (!values.some((value) => rowMatchesFieldValue(row, field, value))) {
        return false;
      }
    }
    return true;
  });
}

function rowMatchesFieldValue(
  row: ScheduleEntry,
  field: CalendarSearchField,
  value: string,
): boolean {
  const v = value.trim().toLowerCase();
  switch (field) {
    case "faculty":
      return row.facultyCode.trim().toLowerCase() === v;
    case "module":
      return row.moduleCode.trim().toLowerCase() === v;
    case "offering":
      return row.modOffCode.trim().toLowerCase() === v;
    case "room":
      return row.roomCode.trim().toLowerCase() === v;
    case "lecturer":
      return (row.lecturer ?? "").trim().toLowerCase() === v;
    case "activity":
      return row.activityCode.trim().toLowerCase() === v;
    case "day":
      return row.day.trim().toLowerCase() === v ||
        row.day.slice(0, 3).toLowerCase() === v.slice(0, 3);
    case "weeks":
      return (row.weeks ?? "").trim().toLowerCase() === v;
    case "academicYear":
      return (row.academicYear ?? "").trim().toLowerCase() === v;
    case "period":
      return (row.periodSlot ?? "").trim().toLowerCase() === v;
    case "any":
    default:
      return fieldHaystack(row, "any").toLowerCase().includes(v);
  }
}
