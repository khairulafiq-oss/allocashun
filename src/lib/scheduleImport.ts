import * as XLSX from "xlsx";
import { parseCsvText } from "./csvParse";
import { findScheduleClashes } from "./clashDetection";
import { resolveImportCalendar } from "./scheduleCalendar";
import { isAllowedScheduleSlot } from "./schedulingRules";
import {
  dateToTeachingWeek,
  dayFromDate,
  formatWeeks,
  parseImportDate,
} from "./weeks";
import type {
  AcademicCalendar,
  Activity,
  Faculty,
  OfferingGroup,
  Room,
  ScheduleEntry,
  TimeRules,
} from "../types";

export type ImportMode = "merge" | "replace";

export type ImportPreviewRow = {
  line: number;
  lineEnd?: number;
  status: "ok" | "warning" | "error";
  messages: string[];
  hasClash?: boolean;
  entry?: ScheduleEntry;
};

export type ImportPreview = {
  fileName: string;
  rows: ImportPreviewRow[];
  ready: ScheduleEntry[];
  errorCount: number;
  warningCount: number;
  sourceRowCount?: number;
  mergedNote?: string;
};

type ParsedTable = {
  headers: string[];
  rows: string[][];
};

type ImportLabels = {
  missingColumn: (column: string) => string;
  missingWeeksOrDate: () => string;
  missingField: (field: string, line: number) => string;
  invalidDay: (line: number) => string;
  invalidTime: (line: number) => string;
  invalidDate: (line: number) => string;
  invalidWeek: (line: number) => string;
  dateOutsideCalendar: (line: number) => string;
  noCalendarForRow: (line: number) => string;
  dayDateMismatch: (line: number) => string;
  mergedSessions: (
    from: number,
    to: number,
    count: number,
    weeks: string,
  ) => string;
  unknownFaculty: (code: string, line: number) => string;
  unknownRoom: (code: string, line: number) => string;
  unknownActivity: (code: string, line: number) => string;
  unknownOffering: (code: string, line: number) => string;
  invalidSlot: (day: string, slot: string, line: number) => string;
  clash: (detail: string, line: number) => string;
  mergedSummary: (sourceRows: number, slots: number) => string;
};

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const HEADER_ALIASES: Record<string, string> = {
  faculty: "faculty",
  facultycode: "faculty",
  offering: "offering",
  modoffcode: "offering",
  offeredgroup: "offering",
  offeringgroup: "offering",
  module: "module",
  modulecode: "module",
  occurrence: "occurrence",
  activity: "activity",
  activitycode: "activity",
  lecturer: "lecturer",
  staffid: "lecturer",
  room: "room",
  roomcode: "room",
  day: "day",
  start: "start",
  starttime: "start",
  begintime: "start",
  end: "end",
  endtime: "end",
  weeks: "weeks",
  week: "week",
  weekno: "week",
  weeknumber: "week",
  teachingweek: "week",
  begindate: "date",
  begindatetime: "date",
  date: "date",
  sessiondate: "date",
  classdate: "date",
  tarikh: "date",
  teachingdate: "date",
  academicyear: "academicyear",
  year: "academicyear",
  period: "period",
  periodslot: "period",
  facultyname: "facultyname",
  modulename: "modulename",
  activityname: "activityname",
  roomname: "roomname",
};

const PATTERN_REQUIRED_KEYS = [
  "offering",
  "activity",
  "lecturer",
  "room",
  "day",
  "start",
  "end",
  "weeks",
] as const;

const EXPANDED_REQUIRED_KEYS = [
  "offering",
  "activity",
  "lecturer",
  "room",
  "start",
  "end",
] as const;

type LookupMaps = {
  facultyByCode: Map<string, Faculty>;
  roomByCode: Map<string, Room>;
  activityByCode: Map<string, Activity>;
  offeringByCode: Map<string, OfferingGroup>;
};

type ParsedSlotFields = {
  faculty: Faculty;
  offeringCode: string;
  moduleCode: string;
  occurrence: string;
  activityCode: string;
  lecturer: string;
  roomCode: string;
  day: string;
  startTime: string;
  endTime: string;
  academicYear: string;
  periodSlot: string;
  facultyName: string;
  moduleName: string;
  activityName: string;
  roomName: string;
  offering?: OfferingGroup;
  room?: Room;
  activity?: Activity;
};

type SessionDraft = ParsedSlotFields & {
  line: number;
  weekNum: number;
  messages: string[];
};

type ImportContext = {
  faculties: Faculty[];
  rooms: Room[];
  activities: Activity[];
  offeringGroups: OfferingGroup[];
  timeRules: TimeRules;
  calendars: AcademicCalendar[];
  preferredCalendars?: AcademicCalendar[];
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "");
}

function normalizeDay(day: string): string | null {
  const key = day.trim().slice(0, 3).toLowerCase();
  const match = DAY_ORDER.find((d) => d.toLowerCase() === key);
  return match ?? null;
}

function normalizeTime(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function tableFromCsvText(text: string): ParsedTable {
  const matrix = parseCsvText(text);
  if (matrix.length === 0) return { headers: [], rows: [] };
  const [headers, ...rows] = matrix;
  return {
    headers: headers.map((cell) => cell.trim()),
    rows,
  };
}

function tableFromWorkbook(buffer: ArrayBuffer): ParsedTable {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  if (matrix.length === 0) return { headers: [], rows: [] };
  const [headers, ...rows] = matrix;
  return {
    headers: (headers ?? []).map((cell) => String(cell ?? "").trim()),
    rows: rows.map((row) => row.map((cell) => String(cell ?? "").trim())),
  };
}

function mapHeaders(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((header, index) => {
    const key = HEADER_ALIASES[normalizeHeader(header)];
    if (key && !map.has(key)) map.set(key, index);
  });
  return map;
}

function cell(row: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return (row[index] ?? "").trim();
}

function makeLookups(context: ImportContext): LookupMaps {
  return {
    facultyByCode: new Map(
      context.faculties.map((f) => [f.facultyCode.toUpperCase(), f]),
    ),
    roomByCode: new Map(
      context.rooms.map((r) => [r.roomCode.toUpperCase(), r]),
    ),
    activityByCode: new Map(
      context.activities.map((a) => [a.activityCode.toUpperCase(), a]),
    ),
    offeringByCode: new Map(
      context.offeringGroups.map((o) => [o.modOffCode.toUpperCase(), o]),
    ),
  };
}

function slotGroupKey(fields: ParsedSlotFields): string {
  return [
    fields.faculty.facultyCode,
    fields.offeringCode,
    fields.moduleCode,
    fields.occurrence,
    fields.activityCode,
    fields.lecturer,
    fields.roomCode,
    fields.day,
    fields.startTime,
    fields.endTime,
    fields.academicYear,
    fields.periodSlot,
  ].join("|");
}

function splitCsvValues(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseSlotFields(
  row: string[],
  line: number,
  headerMap: Map<string, number>,
  lookups: LookupMaps,
  labels: ImportLabels,
  timeRules: TimeRules,
  options: {
    requireDay: boolean;
    requireWeeks: boolean;
    requireOccurrence: boolean;
  },
  offeringCode: string,
  lecturer: string,
): { ok: true; fields: ParsedSlotFields; messages: string[]; status: ImportPreviewRow["status"] } | { ok: false; preview: ImportPreviewRow } {
  const get = (key: string) => cell(row, headerMap.get(key));
  const messages: string[] = [];
  let status: ImportPreviewRow["status"] = "ok";

  let facultyCode = get("faculty").toUpperCase();
  let moduleCode = get("module");
  let occurrence = get("occurrence");
  const activityCode = get("activity").toUpperCase();
  const roomCode = get("room");
  const dayRaw = get("day");
  const startRaw = get("start");
  const endRaw = get("end");
  const weeks = get("weeks");
  let academicYear = get("academicyear");
  let periodSlot = get("period").toUpperCase();

  const required: [string, string][] = [
    ["Offered Group", offeringCode],
    ["Activity", activityCode],
    ["Lecturer", lecturer],
    ["Room", roomCode],
    ["Begin Time", startRaw],
    ["End Time", endRaw],
  ];
  if (options.requireDay) required.push(["Day", dayRaw]);
  if (options.requireWeeks) required.push(["Weeks", weeks]);
  if (options.requireOccurrence) required.push(["Occurrence", occurrence]);

  for (const [key, value] of required) {
    if (!value) {
      messages.push(labels.missingField(key, line));
      status = "error";
    }
  }
  if (status === "error") {
    return { ok: false, preview: { line, status, messages } };
  }

  let day = dayRaw ? normalizeDay(dayRaw) : null;
  if (options.requireDay && !day) {
    return {
      ok: false,
      preview: { line, status: "error", messages: [labels.invalidDay(line)] },
    };
  }

  const startTime = normalizeTime(startRaw);
  const endTime = normalizeTime(endRaw);
  if (!startTime || !endTime || startTime >= endTime) {
    return {
      ok: false,
      preview: { line, status: "error", messages: [labels.invalidTime(line)] },
    };
  }

  const offering = lookups.offeringByCode.get(offeringCode.toUpperCase());
  if (!offering) {
    messages.push(labels.unknownOffering(offeringCode, line));
    status = "warning";
  } else {
    // Prefer offering master data so comma-separated groups keep their own occurrence.
    occurrence = offering.occurrence || occurrence;
    academicYear = academicYear || offering.academicYear;
    periodSlot = periodSlot || offering.periodSlot;
    facultyCode = facultyCode || offering.facultyCode.toUpperCase();
    moduleCode = moduleCode || offering.moduleCode;
  }

  if (!facultyCode) {
    messages.push(labels.missingField("Faculty Code", line));
    status = "error";
  }
  if (!moduleCode) {
    messages.push(labels.missingField("Module Code", line));
    status = "error";
  }
  if (status === "error") {
    return { ok: false, preview: { line, status, messages } };
  }

  const faculty = lookups.facultyByCode.get(facultyCode);
  if (!faculty) {
    return {
      ok: false,
      preview: {
        line,
        status: "error",
        messages: [labels.unknownFaculty(facultyCode, line)],
      },
    };
  }

  const room = lookups.roomByCode.get(roomCode.toUpperCase());
  if (!room) {
    messages.push(labels.unknownRoom(roomCode, line));
    status = "warning";
  }

  const activity = lookups.activityByCode.get(activityCode);
  if (!activity) {
    messages.push(labels.unknownActivity(activityCode, line));
    status = "warning";
  }

  if (day) {
    const slot = `${startTime}-${endTime}`;
    if (!isAllowedScheduleSlot(timeRules, day, startTime, endTime)) {
      messages.push(labels.invalidSlot(day, slot, line));
      status = "warning";
    }
  }

  if (!occurrence) {
    messages.push(labels.missingField("Occurrence", line));
    status = "error";
  }
  if (!academicYear) {
    messages.push(labels.missingField("AcademicYear", line));
    status = "error";
  }
  if (!periodSlot) {
    messages.push(labels.missingField("Period", line));
    status = "error";
  }

  if (status === "error") {
    return { ok: false, preview: { line, status, messages } };
  }

  return {
    ok: true,
    fields: {
      faculty,
      offeringCode,
      moduleCode,
      occurrence,
      activityCode,
      lecturer,
      roomCode,
      day: day ?? "",
      startTime,
      endTime,
      academicYear,
      periodSlot,
      facultyName: get("facultyname") || faculty.fullName,
      moduleName: get("modulename") || offering?.moduleName || moduleCode,
      activityName: get("activityname") || activity?.activityName || activityCode,
      roomName: get("roomname") || room?.shortName || room?.fullName || roomCode,
      offering,
      room,
      activity,
    },
    messages,
    status,
  };
}

function buildEntryFromFields(
  fields: ParsedSlotFields,
  weeks: string,
  stamp: number,
  index: number,
): ScheduleEntry {
  const slot = `${fields.startTime}-${fields.endTime}`;
  return {
    id: `import-${stamp}-${index}`,
    facultyCode: fields.faculty.facultyCode,
    facultyName: fields.facultyName,
    offeringId: fields.offering?.id ?? `import-off-${fields.offeringCode}`,
    modOffCode: fields.offeringCode,
    moduleCode: fields.moduleCode,
    moduleName: fields.moduleName,
    occurrence: fields.occurrence,
    activityCode: fields.activityCode,
    activityName: fields.activityName,
    roomCode: fields.roomCode,
    roomName: fields.roomName,
    lecturer: fields.lecturer,
    day: fields.day,
    slot,
    startTime: fields.startTime,
    endTime: fields.endTime,
    weeks,
    academicYear: fields.academicYear,
    periodSlot: fields.periodSlot,
    createdAt: new Date().toISOString(),
  };
}

function finalizePreview(
  fileName: string,
  previewRows: ImportPreviewRow[],
  ready: ScheduleEntry[],
  extra?: Pick<ImportPreview, "sourceRowCount" | "mergedNote">,
): ImportPreview {
  return {
    fileName,
    rows: previewRows,
    ready,
    errorCount: previewRows.filter((row) => row.status === "error").length,
    warningCount: previewRows.filter((row) => row.status === "warning").length,
    ...extra,
  };
}

function buildPatternImportPreview(
  table: ParsedTable,
  fileName: string,
  existing: ScheduleEntry[],
  context: ImportContext,
  labels: ImportLabels,
  headerMap: Map<string, number>,
): ImportPreview {
  const lookups = makeLookups(context);
  const previewRows: ImportPreviewRow[] = [];
  const ready: ScheduleEntry[] = [];
  const stamp = Date.now();

  for (let i = 0; i < table.rows.length; i++) {
    const line = i + 2;
    const row = table.rows[i];
    if (row.every((cell) => !cell.trim())) continue;

    const offeringCodes = splitCsvValues(
      cell(row, headerMap.get("offering")),
    );
    if (offeringCodes.length === 0) {
      previewRows.push({
        line,
        status: "error",
        messages: [labels.missingField("Offered Group", line)],
      });
      continue;
    }

    const lecturers = splitCsvValues(cell(row, headerMap.get("lecturer")));
    if (lecturers.length === 0) {
      previewRows.push({
        line,
        status: "error",
        messages: [labels.missingField("Lecturer", line)],
      });
      continue;
    }

    const weeks = cell(row, headerMap.get("weeks"));
    for (const offeringCode of offeringCodes) {
      for (const lecturer of lecturers) {
        const parsed = parseSlotFields(
          row,
          line,
          headerMap,
          lookups,
          labels,
          context.timeRules,
          { requireDay: true, requireWeeks: true, requireOccurrence: false },
          offeringCode,
          lecturer,
        );
        if (!parsed.ok) {
          previewRows.push(parsed.preview);
          continue;
        }

        const { fields, messages, status } = parsed;
        const entry = buildEntryFromFields(fields, weeks, stamp, ready.length);

        const clashes = findScheduleClashes(
          entry,
          [...existing, ...ready],
          context.timeRules,
        );
        const hasClash = clashes.length > 0;
        let rowStatus = status;
        if (clashes.length > 0) {
          messages.push(
            labels.clash(
              clashes
                .slice(0, 2)
                .map((hit) => hit.detail)
                .join("; "),
              line,
            ),
          );
          rowStatus = "warning";
        }

        previewRows.push({
          line,
          status: rowStatus,
          messages,
          hasClash,
          entry,
        });
        ready.push(entry);
      }
    }
  }

  return finalizePreview(fileName, previewRows, ready);
}

function buildExpandedImportPreview(
  table: ParsedTable,
  fileName: string,
  existing: ScheduleEntry[],
  context: ImportContext,
  labels: ImportLabels,
  headerMap: Map<string, number>,
): ImportPreview {
  const lookups = makeLookups(context);
  const previewRows: ImportPreviewRow[] = [];
  const groups = new Map<string, SessionDraft[]>();
  let sourceRowCount = 0;

  for (let i = 0; i < table.rows.length; i++) {
    const line = i + 2;
    const row = table.rows[i];
    if (row.every((cell) => !cell.trim())) continue;
    sourceRowCount += 1;

    const get = (key: string) => cell(row, headerMap.get(key));
    const offeringCodes = splitCsvValues(get("offering"));
    if (offeringCodes.length === 0) {
      previewRows.push({
        line,
        status: "error",
        messages: [labels.missingField("Offered Group", line)],
      });
      continue;
    }

    const lecturers = splitCsvValues(get("lecturer"));
    if (lecturers.length === 0) {
      previewRows.push({
        line,
        status: "error",
        messages: [labels.missingField("Lecturer", line)],
      });
      continue;
    }

    for (const offeringCode of offeringCodes) {
      for (const lecturer of lecturers) {
        const parsed = parseSlotFields(
          row,
          line,
          headerMap,
          lookups,
          labels,
          context.timeRules,
          {
            requireDay: !headerMap.has("date"),
            requireWeeks: false,
            requireOccurrence: false,
          },
          offeringCode,
          lecturer,
        );
        if (!parsed.ok) {
          previewRows.push(parsed.preview);
          continue;
        }

        const { fields, messages } = parsed;

        let weekNum: number | null = null;
        const dateRaw = get("date");
        const weekRaw = get("week");

        // Prefer explicit Week when present; Begin Date is a fallback.
        if (weekRaw) {
          const parsedWeek = Number(weekRaw);
          if (!Number.isInteger(parsedWeek) || parsedWeek < 1) {
            previewRows.push({
              line,
              status: "error",
              messages: [labels.invalidWeek(line)],
            });
            continue;
          }
          weekNum = parsedWeek;
        } else if (dateRaw) {
          const date = parseImportDate(dateRaw);
          if (!date) {
            previewRows.push({
              line,
              status: "error",
              messages: [labels.invalidDate(line)],
            });
            continue;
          }

          const calendar = resolveImportCalendar(
            fields.academicYear,
            fields.periodSlot,
            context.calendars,
            context.preferredCalendars,
          );
          if (!calendar) {
            previewRows.push({
              line,
              status: "error",
              messages: [labels.noCalendarForRow(line)],
            });
            continue;
          }

          weekNum = dateToTeachingWeek(date, calendar);
          if (weekNum === null) {
            previewRows.push({
              line,
              status: "error",
              messages: [labels.dateOutsideCalendar(line)],
            });
            continue;
          }

          const dateDay = dayFromDate(date);
          if (!fields.day) {
            fields.day = dateDay;
          } else if (fields.day !== dateDay) {
            messages.push(labels.dayDateMismatch(line));
          }
        } else {
          previewRows.push({
            line,
            status: "error",
            messages: [labels.missingField("Week or Begin Date", line)],
          });
          continue;
        }

        if (!fields.day) {
          previewRows.push({
            line,
            status: "error",
            messages: [labels.invalidDay(line)],
          });
          continue;
        }

        const slot = `${fields.startTime}-${fields.endTime}`;
        if (
          !isAllowedScheduleSlot(
            context.timeRules,
            fields.day,
            fields.startTime,
            fields.endTime,
          )
        ) {
          messages.push(labels.invalidSlot(fields.day, slot, line));
        }

        const key = slotGroupKey(fields);
        const draft: SessionDraft = { ...fields, line, weekNum, messages };
        const bucket = groups.get(key) ?? [];
        bucket.push(draft);
        groups.set(key, bucket);
      }
    }
  }

  const ready: ScheduleEntry[] = [];
  const stamp = Date.now();
  let groupIndex = 0;

  for (const drafts of groups.values()) {
    drafts.sort((a, b) => a.line - b.line);
    const lines = drafts.map((d) => d.line);
    const firstLine = lines[0] ?? 0;
    const lastLine = lines[lines.length - 1] ?? firstLine;
    const fields = drafts[0];
    const weekNums = [...new Set(drafts.map((d) => d.weekNum))].sort((a, b) => a - b);
    const weeks = formatWeeks(weekNums);

    const messages: string[] = [
      ...new Set(drafts.flatMap((draft) => draft.messages)),
    ];
    let status: ImportPreviewRow["status"] =
      messages.length > 0 ? "warning" : "ok";
    if (drafts.length > 1 || lines.length > 1) {
      messages.push(
        labels.mergedSessions(firstLine, lastLine, drafts.length, weeks),
      );
    }

    const entry = buildEntryFromFields(fields, weeks, stamp, groupIndex);
    groupIndex += 1;

    const clashes = findScheduleClashes(
      entry,
      [...existing, ...ready],
      context.timeRules,
    );
    const hasClash = clashes.length > 0;
    if (clashes.length > 0) {
      messages.push(
        labels.clash(
          clashes
            .slice(0, 2)
            .map((hit) => hit.detail)
            .join("; "),
          firstLine,
        ),
      );
      status = "warning";
    }

    previewRows.push({
      line: firstLine,
      lineEnd: lastLine !== firstLine ? lastLine : undefined,
      status,
      messages,
      hasClash,
      entry,
    });
    ready.push(entry);
  }

  previewRows.sort((a, b) => a.line - b.line);

  const mergedNote =
    sourceRowCount > ready.length
      ? labels.mergedSummary(sourceRowCount, ready.length)
      : undefined;

  return finalizePreview(fileName, previewRows, ready, {
    sourceRowCount,
    mergedNote,
  });
}

export async function readImportTable(file: File): Promise<ParsedTable> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const text = await file.text();
    return tableFromCsvText(text);
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    return tableFromWorkbook(buffer);
  }
  throw new Error("UNSUPPORTED_FORMAT");
}

export function buildImportPreview(
  table: ParsedTable,
  fileName: string,
  existing: ScheduleEntry[],
  context: ImportContext,
  labels: ImportLabels,
): ImportPreview {
  const headerMap = mapHeaders(table.headers);
  const hasWeeksColumn = headerMap.has("weeks");
  const hasDateColumn = headerMap.has("date");
  const hasWeekColumn = headerMap.has("week");

  if (!hasWeeksColumn && !hasDateColumn && !hasWeekColumn) {
    return {
      fileName,
      rows: [
        {
          line: 1,
          status: "error",
          messages: [labels.missingWeeksOrDate()],
        },
      ],
      ready: [],
      errorCount: 1,
      warningCount: 0,
    };
  }

  if (hasWeeksColumn) {
    const missingColumns = PATTERN_REQUIRED_KEYS.filter(
      (key) => !headerMap.has(key),
    );
    if (missingColumns.length > 0) {
      return {
        fileName,
        rows: missingColumns.map((column) => ({
          line: 1,
          status: "error",
          messages: [labels.missingColumn(column)],
        })),
        ready: [],
        errorCount: missingColumns.length,
        warningCount: 0,
      };
    }
    return buildPatternImportPreview(
      table,
      fileName,
      existing,
      context,
      labels,
      headerMap,
    );
  }

  const missingColumns = EXPANDED_REQUIRED_KEYS.filter(
    (key) => !headerMap.has(key),
  );
  if (missingColumns.length > 0) {
    return {
      fileName,
      rows: missingColumns.map((column) => ({
        line: 1,
        status: "error",
        messages: [labels.missingColumn(column)],
      })),
      ready: [],
      errorCount: missingColumns.length,
      warningCount: 0,
    };
  }

  return buildExpandedImportPreview(
    table,
    fileName,
    existing,
    context,
    labels,
    headerMap,
  );
}
