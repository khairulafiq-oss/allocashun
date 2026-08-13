import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FlashBanner } from "../../components/FlashBanner";
import { ScheduleDetailDialog } from "../../components/ScheduleDetailDialog";
import { ScheduleImportDialog } from "../../components/ScheduleImportDialog";
import { WeekTimetableGrid } from "../../components/WeekTimetableGrid";
import { useLanguage } from "../../i18n/LanguageContext";
import { findScheduleClashes } from "../../lib/clashDetection";
import { scheduleEntryMatchesCalendars } from "../../lib/scheduleCalendar";
import {
  buildImportPreview,
  readImportTable,
  type ImportMode,
  type ImportPreview,
} from "../../lib/scheduleImport";
import {
  getSchedulableDays,
  getSlotsForDay,
  isAllowedScheduleSlot,
} from "../../lib/schedulingRules";
import { constraintPickerLabel } from "../../lib/scheduleConstraints";
import {
  defaultWeeksPattern,
  formatWeeks,
  noClassHits,
  noClassWeeks,
  parseWeeks,
  teachingWeekList,
  weeksOutsideTeaching,
} from "../../lib/weeks";
import { useStore } from "../../state/StoreContext";
import {
  clearSchedule,
  scheduleToCsv,
} from "../../storage/scheduleStorage";
import type {
  Module,
  OfferingGroup,
  Room,
  ScheduleEntry,
} from "../../types";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PAGE_SIZE = 100;

function splitSlot(slot: string): { start: string; end: string } {
  const [start = "", end = ""] = slot.split("-");
  return { start, end };
}

function daySortKey(day: string): number {
  const idx = DAY_ORDER.findIndex(
    (d) => d.toLowerCase() === day.slice(0, 3).toLowerCase(),
  );
  return idx === -1 ? 99 : idx;
}

function roomFacultyCode(udf01: string): string {
  return (udf01 ?? "").trim().toUpperCase();
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

type Chip = { id: string; label: string; sub?: string };

function SearchField({
  value,
  applied,
  placeholder,
  disabled,
  searchLabel,
  onChange,
  onSearch,
  onClear,
}: {
  value: string;
  applied: string;
  placeholder: string;
  disabled?: boolean;
  searchLabel: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
}) {
  return (
    <div className="tt-search-row">
      <input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSearch();
          }
        }}
      />
      <button
        type="button"
        className="btn btn-sm"
        disabled={disabled}
        onClick={onSearch}
      >
        {searchLabel}
      </button>
      {applied ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled}
          onClick={onClear}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function SelectedChips({
  items,
  onRemove,
}: {
  items: Chip[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="tt-chips">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="tt-chip"
          onClick={() => onRemove(item.id)}
          title={item.sub ?? item.label}
        >
          <span>{item.label}</span>
          <span aria-hidden>×</span>
        </button>
      ))}
    </div>
  );
}

function SuggestList<T extends { id: string }>({
  items,
  selectedIds,
  render,
  empty,
  onToggle,
  getId = (item) => item.id,
  pageSize = PAGE_SIZE,
}: {
  items: T[];
  selectedIds: string[];
  render: (item: T) => { title: string; sub: string };
  empty: string;
  onToggle: (item: T) => void;
  getId?: (item: T) => string;
  pageSize?: number;
}) {
  const [visible, setVisible] = useState(pageSize);
  const shown = items.slice(0, visible);
  const remaining = Math.max(0, items.length - shown.length);

  if (items.length === 0) {
    return <p className="tt-suggest-empty">{empty}</p>;
  }

  return (
    <div className="tt-suggest">
      <p className="tt-suggest-count">
        {shown.length} / {items.length}
      </p>
      {shown.map((item) => {
        const { title, sub } = render(item);
        const id = getId(item);
        const active = selectedIds.includes(id);
        return (
          <button
            key={id}
            type="button"
            className={active ? "tt-suggest-item active" : "tt-suggest-item"}
            onClick={() => onToggle(item)}
          >
            <strong>
              {active ? "✓ " : ""}
              {title}
            </strong>
            <span>{sub}</span>
          </button>
        );
      })}
      {remaining > 0 ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm tt-load-more"
          onClick={() => setVisible((n) => n + pageSize)}
        >
          +{Math.min(pageSize, remaining)} more ({remaining} left)
        </button>
      ) : null}
    </div>
  );
}

export function MechaSetupPage() {
  const { t } = useLanguage();
  const {
    faculties,
    rooms,
    activities,
    modules,
    offeringGroups,
    paramListsReady,
    calendars,
    timeRules,
    schedule,
    setSchedule,
    cancelledSchedule,
    archiveScheduleEntries,
    restoreCancelledEntry,
    purgeCancelledEntry,
    setMechaSelection,
    pushAudit,
    setFlash,
  } = useStore();

  const [calendarIds, setCalendarIds] = useState<string[]>(() => {
    const active = calendars.find((c) => c.isActive)?.id ?? calendars[0]?.id;
    return active ? [active] : [];
  });
  const [calendarDraft, setCalendarDraft] = useState("");
  const [calendarQuery, setCalendarQuery] = useState("");
  const [facultyCodes, setFacultyCodes] = useState<string[]>([]);
  const [facultyDraft, setFacultyDraft] = useState("");
  const [facultyQuery, setFacultyQuery] = useState("");
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [moduleDraft, setModuleDraft] = useState("");
  const [moduleQuery, setModuleQuery] = useState("");
  const [offeringIds, setOfferingIds] = useState<string[]>([]);
  const [offeringDraft, setOfferingDraft] = useState("");
  const [offeringQuery, setOfferingQuery] = useState("");
  const [roomCodes, setRoomCodes] = useState<string[]>([]);
  const [roomDraft, setRoomDraft] = useState("");
  const [roomQuery, setRoomQuery] = useState("");
  const [lecturerIds, setLecturerIds] = useState<string[]>([]);
  const [lecturerDraft, setLecturerDraft] = useState("");
  const [lecturerQuery, setLecturerQuery] = useState("");
  const [activityCode, setActivityCode] = useState("");
  const [constraintId, setConstraintId] = useState("");
  const [day, setDay] = useState("");
  const [slot, setSlot] = useState("");
  const [weeks, setWeeks] = useState(() =>
    defaultWeeksPattern(calendars.find((c) => c.isActive) ?? calendars[0] ?? null),
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const [addInlineNotice, setAddInlineNotice] = useState<string | null>(null);
  const [allowClash, setAllowClash] = useState(false);
  const [roomShowAll, setRoomShowAll] = useState(false);
  const [lecturerShowAll, setLecturerShowAll] = useState(false);
  const [boardSelectMode, setBoardSelectMode] = useState(false);
  const [boardSelectedIds, setBoardSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  const [cancelListOpen, setCancelListOpen] = useState(false);
  const [purgeCancelId, setPurgeCancelId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [importing, setImporting] = useState(false);
  const [allowImportClashes, setAllowImportClashes] = useState(false);
  const [detailEntries, setDetailEntries] = useState<ScheduleEntry[] | null>(
    null,
  );

  const selectedCalendars = useMemo(
    () => calendars.filter((c) => calendarIds.includes(c.id)),
    [calendars, calendarIds],
  );

  // Keep the latest parameter selections in a shared Store state so the
  // Calendar app can render a live draft preview + clash intensity.
  useEffect(() => {
    const moduleCodes = modules
      .filter((m) => moduleIds.includes(m.id))
      .map((m) => m.moduleCode);

    const selectedOfferings = offeringGroups.filter((o) =>
      offeringIds.includes(o.id),
    );

    const academicYears = [
      ...new Set<string>([
        ...selectedCalendars.map((c) => c.academicYear).filter(Boolean),
        ...selectedOfferings.map((o) => o.academicYear).filter(Boolean),
      ]),
    ];

    const periodSlots = [
      ...new Set<string>(selectedOfferings.map((o) => o.periodSlot).filter(Boolean)),
    ];

    const weeksEnabled = !!activityCode.trim() && !!day && !!slot;
    const weeksValue = weeksEnabled ? weeks.trim() : "";

    setMechaSelection({
      facultyCodes: [...facultyCodes],
      moduleCodes: [...moduleCodes],
      offeringIds: [...offeringIds],
      roomCodes: [...roomCodes],
      lecturerIds: [...lecturerIds],
      activityCode: activityCode.trim(),
      day,
      slot,
      weeks: weeksValue,
      academicYears,
      periodSlots,
    });
  }, [
    facultyCodes,
    modules,
    moduleIds,
    offeringGroups,
    offeringIds,
    roomCodes,
    lecturerIds,
    activityCode,
    day,
    slot,
    weeks,
    selectedCalendars,
    setMechaSelection,
  ]);

  // Auto-hide the inline notice after 5s.
  useEffect(() => {
    if (!addInlineNotice) return;
    const t = window.setTimeout(() => setAddInlineNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [addInlineNotice]);

  const calendarMatches = useMemo(() => {
    const q = calendarQuery.trim().toLowerCase();
    if (!q) return calendars;
    return calendars.filter((c) => {
      const hay = [
        c.academicYear,
        c.semester,
        c.notes,
        `${c.teachingWeeksStart}-${c.teachingWeeksEnd}`,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [calendars, calendarQuery]);

  const activeFaculties = useMemo(
    () =>
      [...faculties]
        .filter((f) => f.active)
        .sort((a, b) =>
          a.facultyCode.localeCompare(b.facultyCode, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        ),
    [faculties],
  );

  const facultyMatches = useMemo(() => {
    const q = facultyQuery.trim().toLowerCase();
    if (!q) return activeFaculties;
    return activeFaculties.filter((f) => {
      const hay = [f.facultyCode, f.shortName, f.fullName, f.fullNameBm, f.email]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [activeFaculties, facultyQuery]);

  const facultySet = useMemo(
    () => new Set(facultyCodes.map((c) => c.toUpperCase())),
    [facultyCodes],
  );

  const facultyModules = useMemo(() => {
    const base = modules.filter((m) => m.active);
    const list =
      facultySet.size === 0
        ? base
        : base.filter((m) => facultySet.has(m.faculty.trim().toUpperCase()));
    return list
      .sort((a, b) =>
        a.moduleCode.localeCompare(b.moduleCode, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [modules, facultySet]);

  const moduleMatches = useMemo(() => {
    const q = moduleQuery.trim().toLowerCase();
    if (!q) return facultyModules;
    return facultyModules.filter((m) => {
      const hay = [m.moduleCode, m.moduleEngDesc, m.moduleMalayDesc]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [facultyModules, moduleQuery]);

  const selectedModules = useMemo(
    () => facultyModules.filter((m) => moduleIds.includes(m.id)),
    [facultyModules, moduleIds],
  );

  const selectedModuleCodes = useMemo(
    () =>
      new Set(selectedModules.map((m) => m.moduleCode.toUpperCase())),
    [selectedModules],
  );

  const facultyOfferings = useMemo(() => {
    return offeringGroups
      .filter((o) => {
        if (!o.active) return false;
        if (facultySet.size > 0 && !facultySet.has(o.facultyCode.toUpperCase()))
          return false;
        if (
          selectedModuleCodes.size > 0 &&
          !selectedModuleCodes.has(o.moduleCode.toUpperCase())
        )
          return false;
        return true;
      })
      .sort((a, b) =>
        a.modOffCode.localeCompare(b.modOffCode, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [offeringGroups, facultySet, selectedModuleCodes]);

  const offeringMatches = useMemo(() => {
    const q = offeringQuery.trim().toLowerCase();
    if (!q) return facultyOfferings;
    return facultyOfferings.filter((o) => {
      const hay = [o.modOffCode, o.moduleName, o.occurrence, o.periodSlot]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [facultyOfferings, offeringQuery]);

  const selectedOfferings = useMemo(
    () => facultyOfferings.filter((o) => offeringIds.includes(o.id)),
    [facultyOfferings, offeringIds],
  );

  const allActiveRooms = useMemo(
    () =>
      rooms
        .filter((r) => r.inUse)
        .sort((a, b) =>
          a.roomCode.localeCompare(b.roomCode, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        ),
    [rooms],
  );

  const facultyRooms = useMemo(() => {
    if (facultySet.size === 0) return allActiveRooms;
    return allActiveRooms.filter((r) =>
      facultySet.has(roomFacultyCode(r.udf01)),
    );
  }, [allActiveRooms, facultySet]);

  const displayRooms = roomShowAll ? allActiveRooms : facultyRooms;

  const roomMatches = useMemo(() => {
    const q = roomQuery.trim().toLowerCase();
    if (!q) return displayRooms;
    return displayRooms.filter((r) => {
      const hay = [r.roomCode, r.shortName, r.fullName, r.buildingCode]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [displayRooms, roomQuery]);

  const selectedRooms = useMemo(
    () => allActiveRooms.filter((r) => roomCodes.includes(r.roomCode)),
    [allActiveRooms, roomCodes],
  );

  const lecturersFromOfferings = useMemo(() => {
    const byFaculty = new Map<string, { id: string; label: string }>();
    const all = new Map<string, { id: string; label: string }>();
    for (const o of offeringGroups) {
      if (!o.active) continue;
      const id = (o.coordinatorId ?? "").trim();
      if (!id) continue;
      const entry = { id, label: id };
      if (!all.has(id)) all.set(id, entry);
      if (
        facultySet.size === 0 ||
        facultySet.has(o.facultyCode.toUpperCase())
      ) {
        if (!byFaculty.has(id)) byFaculty.set(id, entry);
      }
    }
    const sortLecturers = (list: { id: string; label: string }[]) =>
      [...list].sort((a, b) =>
        a.id.localeCompare(b.id, undefined, { numeric: true }),
      );
    return {
      faculty: sortLecturers(Array.from(byFaculty.values())),
      all: sortLecturers(Array.from(all.values())),
    };
  }, [offeringGroups, facultySet]);

  const facultyLecturers = lecturersFromOfferings.faculty;
  const allLecturers = lecturersFromOfferings.all;
  const displayLecturers = lecturerShowAll ? allLecturers : facultyLecturers;

  const lecturerMatches = useMemo(() => {
    const q = lecturerQuery.trim().toLowerCase();
    if (!q) return displayLecturers;
    return displayLecturers.filter((lec) => {
      const hay = `${lec.id} ${lec.label}`.toLowerCase();
      return hay.includes(q);
    });
  }, [displayLecturers, lecturerQuery]);

  const lecturerLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const lec of allLecturers) map.set(lec.id, lec.label);
    return map;
  }, [allLecturers]);

  const stepsReady = {
    1: calendarIds.length > 0,
    2: facultyCodes.length > 0,
    3: moduleIds.length > 0,
    4: offeringIds.length > 0,
    5: roomCodes.length > 0,
    6: lecturerIds.length > 0,
  };

  const contextReady =
    selectedOfferings.length > 0 &&
    selectedRooms.length > 0 &&
    lecturerIds.length > 0;

  const activeActivities = useMemo(
    () =>
      [...activities]
        .filter((a) => a.inUse)
        .sort((a, b) =>
          a.activityCode.localeCompare(b.activityCode, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        ),
    [activities],
  );

  const schedulableDays = useMemo(
    () =>
      getSchedulableDays(timeRules).sort(
        (a, b) => daySortKey(a) - daySortKey(b),
      ),
    [timeRules],
  );

  const enabledConstraints = useMemo(
    () => (timeRules.constraints ?? []).filter((c) => c.enabled),
    [timeRules.constraints],
  );

  const daySlots = useMemo(() => {
    if (!day) return [] as string[];
    return getSlotsForDay(timeRules, day, constraintId || null);
  }, [day, timeRules, constraintId]);

  const selectedOfferingCodes = useMemo(
    () =>
      new Set(selectedOfferings.map((o) => o.modOffCode.toUpperCase())),
    [selectedOfferings],
  );

  const boardEntries = useMemo(() => {
    // Board follows live compose selection — wait for module to avoid heavy faculty-wide grids.
    if (
      selectedCalendars.length === 0 ||
      facultyCodes.length === 0 ||
      selectedModuleCodes.size === 0
    ) {
      return [] as ScheduleEntry[];
    }

    const list = schedule.filter((row) => {
      if (!scheduleEntryMatchesCalendars(row, selectedCalendars)) return false;
      if (!facultySet.has(row.facultyCode.toUpperCase())) return false;
      if (!selectedModuleCodes.has(row.moduleCode.toUpperCase())) return false;
      if (
        selectedOfferingCodes.size > 0 &&
        !selectedOfferingCodes.has(row.modOffCode.toUpperCase())
      ) {
        return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const dayDiff = daySortKey(a.day) - daySortKey(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [
    schedule,
    selectedCalendars,
    facultyCodes.length,
    facultySet,
    selectedModuleCodes,
    selectedOfferingCodes,
  ]);

  const boardScopeReady =
    selectedCalendars.length > 0 &&
    facultyCodes.length > 0 &&
    selectedModuleCodes.size > 0;

  const boardWithPreview = useMemo(() => {
    const previewEntries: ScheduleEntry[] = [];
    const previewIds = new Set<string>();
    const warnIds = new Set<string>();

    // Standard clash checking for already-scheduled entries on the board.
    // This marks both sides of every conflict so the user can spot issues immediately.
    for (const row of boardEntries) {
      const clashes = findScheduleClashes(row, boardEntries, timeRules);
      if (!clashes.length) continue;
      warnIds.add(row.id);
      for (const hit of clashes) warnIds.add(hit.againstId);
    }

    const weeksTrimmed = weeks.trim();
    if (
      !stepsReady[1] ||
      !stepsReady[2] ||
      selectedOfferings.length === 0 ||
      selectedRooms.length === 0 ||
      lecturerIds.length === 0 ||
      !activityCode ||
      !day ||
      !slot ||
      !weeksTrimmed
    ) {
      return { previewEntries, previewIds, warnIds };
    }

    const { start, end } = splitSlot(slot);
    if (!start || !end) return { previewEntries, previewIds, warnIds };

    if (!isAllowedScheduleSlot(timeRules, day, start, end, constraintId)) {
      return { previewEntries, previewIds, warnIds };
    }

    const activity =
      activeActivities.find((a) => a.activityCode === activityCode) ?? null;

    const room = selectedRooms[0];
    const lecturer = lecturerIds[0];
    if (!room || !lecturer) return { previewEntries, previewIds, warnIds };

    // Avoid showing duplicates (same core signature already exists).
    const exists = (candidate: ScheduleEntry) =>
      schedule.some(
        (row) =>
          row.facultyCode === candidate.facultyCode &&
          row.modOffCode === candidate.modOffCode &&
          row.day === candidate.day &&
          row.slot === candidate.slot &&
          row.roomCode === candidate.roomCode &&
          (row.lecturer ?? "").toLowerCase() === lecturer.toLowerCase() &&
          row.activityCode === (candidate.activityCode ?? "") &&
          String(row.weeks ?? "").trim() === weeksTrimmed,
      );

    for (const offering of selectedOfferings) {
      const faculty =
        activeFaculties.find(
          (f) =>
            f.facultyCode.toUpperCase() === offering.facultyCode.toUpperCase(),
        ) ?? activeFaculties.find((f) => facultyCodes.includes(f.facultyCode));

      if (!faculty) continue;

      const id = `prev-${offering.id}-${faculty.facultyCode}-${day}-${slot}-${room.roomCode}-${lecturer}-${weeksTrimmed}-${activityCode}`;

      const candidate: ScheduleEntry = {
        id,
        facultyCode: faculty.facultyCode,
        facultyName: faculty.fullName,
        offeringId: offering.id,
        modOffCode: offering.modOffCode,
        moduleCode: offering.moduleCode,
        moduleName: offering.moduleName,
        occurrence: offering.occurrence,
        activityCode: activity?.activityCode ?? activityCode,
        activityName: activity?.activityName ?? activityCode,
        roomCode: room.roomCode,
        roomName: room.shortName || room.fullName,
        lecturer,
        day,
        slot,
        startTime: start,
        endTime: end,
        weeks: weeksTrimmed,
        academicYear: offering.academicYear,
        periodSlot: offering.periodSlot,
        createdAt: "preview",
      };

      if (exists(candidate)) continue;

      previewEntries.push(candidate);
      previewIds.add(candidate.id);

      const clashes = findScheduleClashes(
        candidate,
        schedule,
        timeRules,
      );
      if (clashes.length > 0) {
        warnIds.add(candidate.id);
        for (const hit of clashes) warnIds.add(hit.againstId);
      }
    }

    return { previewEntries, previewIds, warnIds };
  }, [
    schedule,
    timeRules,
    stepsReady,
    selectedOfferings,
    selectedRooms,
    lecturerIds,
    activityCode,
    day,
    slot,
    weeks,
    constraintId,
    activeActivities,
    activeFaculties,
    facultyCodes,
  ]);

  const displayEntries = useMemo(
    () => [...boardEntries, ...boardWithPreview.previewEntries],
    [boardEntries, boardWithPreview.previewEntries],
  );

  const removableIds = useMemo(() => new Set(boardEntries.map((e) => e.id)), [boardEntries]);

  // Drop stale multi-select when the live board scope changes.
  useEffect(() => {
    setBoardSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((id) => removableIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [removableIds]);

  const visibleCancelled = useMemo(() => {
    return [...cancelledSchedule]
      .filter((row) =>
        scheduleEntryMatchesCalendars(row.entry, selectedCalendars),
      )
      .sort((a, b) => b.cancelledAt.localeCompare(a.cancelledAt));
  }, [cancelledSchedule, selectedCalendars]);

  function cancelReasonLabel(reason: string): string {
    if (reason === "bulk_remove") return t.ttCancelReasonBulk;
    if (reason === "clear_all") return t.ttCancelReasonClear;
    return t.ttCancelReasonRemove;
  }

  function restoreCancelled(cancelId: string) {
    const record = cancelledSchedule.find((row) => row.cancelId === cancelId);
    if (!record) return;
    const clashes = findScheduleClashes(record.entry, schedule, timeRules);
    const restored = restoreCancelledEntry(cancelId);
    if (!restored) return;
    pushAudit(
      "TT_RESTORE",
      `Restored ${restored.modOffCode} ${restored.day} ${restored.slot}`,
    );
    setFlash({
      kind: clashes.length > 0 ? "bad" : "ok",
      message:
        clashes.length > 0
          ? t.ttCancelRestoredClash
          : t.ttCancelRestored.replace("{code}", restored.modOffCode),
    });
  }

  function confirmPurgeCancelled() {
    if (!purgeCancelId) return;
    const record = cancelledSchedule.find((row) => row.cancelId === purgeCancelId);
    purgeCancelledEntry(purgeCancelId);
    if (record) {
      pushAudit(
        "TT_PURGE_CANCELLED",
        `Purged cancelled slot ${record.entry.modOffCode} ${record.entry.day} ${record.entry.slot}`,
      );
    }
    setFlash({ kind: "ok", message: t.ttCancelPurged });
    setPurgeCancelId(null);
  }

  const gridDays = useMemo(() => {
    const set = new Set(
      displayEntries.map((row) => {
        const key = row.day.slice(0, 3);
        return (
          DAY_ORDER.find((d) => d.toLowerCase() === key.toLowerCase()) ?? key
        );
      }),
    );
    const preferred = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const base = preferred.some((d) => set.has(d))
      ? preferred
      : DAY_ORDER.filter((d) => d !== "Sat" && d !== "Sun");
    const extra = DAY_ORDER.filter((d) => set.has(d) && !base.includes(d));
    return [...base, ...extra];
  }, [displayEntries]);

  const primaryCalendar = selectedCalendars[0] ?? null;
  const weekOptions = useMemo(
    () => teachingWeekList(primaryCalendar),
    [primaryCalendar],
  );
  const noClassMap = useMemo(
    () => noClassWeeks(primaryCalendar),
    [primaryCalendar],
  );
  const selectedWeekNums = useMemo(() => parseWeeks(weeks), [weeks]);

  function toggleWeek(week: number) {
    const next = new Set(selectedWeekNums);
    if (next.has(week)) next.delete(week);
    else next.add(week);
    setWeeks(formatWeeks(next));
    setAddInlineNotice(null);
  }

  function syncWeeksFromCalendars(ids: string[]) {
    const cal = calendars.find((c) => c.id === ids[0]) ?? null;
    setWeeks(defaultWeeksPattern(cal));
  }

  function onToggleCalendar(id: string) {
    setCalendarIds((prev) => {
      const next = toggleId(prev, id);
      syncWeeksFromCalendars(next);
      return next;
    });
  }

  function toggleFaculty(code: string) {
    const next = toggleId(facultyCodes, code);
    setFacultyCodes(next);
    setAddInlineNotice(null);
    setModuleIds([]);
    setModuleDraft("");
    setModuleQuery("");
    setOfferingIds([]);
    setOfferingDraft("");
    setOfferingQuery("");
    setRoomCodes([]);
    setRoomDraft("");
    setRoomQuery("");
    setLecturerIds([]);
    setLecturerDraft("");
    setLecturerQuery("");
    setRoomShowAll(false);
    setLecturerShowAll(false);
    setActivityCode("");
    setDay("");
    setSlot("");
  }

  function toggleModule(mod: Module) {
    setModuleIds((prev) => toggleId(prev, mod.id));
    setAddInlineNotice(null);
    setOfferingIds([]);
    setOfferingDraft("");
    setOfferingQuery("");
  }

  function toggleOffering(offering: OfferingGroup) {
    setOfferingIds((prev) => {
      const next = toggleId(prev, offering.id);
      setAddInlineNotice(null);
      const coord = (offering.coordinatorId ?? "").trim();
      if (coord && next.includes(offering.id) && !lecturerIds.includes(coord)) {
        setLecturerIds((lecs) => [...lecs, coord]);
      }
      return next;
    });
  }

  function toggleRoom(room: Room) {
    setRoomCodes((prev) => toggleId(prev, room.roomCode));
    setAddInlineNotice(null);
  }

  function toggleLecturer(id: string) {
    setLecturerIds((prev) => toggleId(prev, id));
    setAddInlineNotice(null);
  }

  function onPickDay(next: string) {
    setDay(next);
    setSlot("");
    setAddInlineNotice(null);
  }

  function addEntry() {
    setAddInlineNotice(null);
    if (selectedModules.length === 0) {
      setFlash({ kind: "bad", message: t.ttNeedModule });
      setAddInlineNotice(t.ttNeedModule);
      return;
    }
    if (selectedOfferings.length === 0) {
      setFlash({ kind: "bad", message: t.ttNeedOffering });
      setAddInlineNotice(t.ttNeedOffering);
      return;
    }
    if (selectedRooms.length === 0) {
      setFlash({ kind: "bad", message: t.ttNeedRoom });
      setAddInlineNotice(t.ttNeedRoom);
      return;
    }
    if (lecturerIds.length === 0) {
      setFlash({ kind: "bad", message: t.ttNeedLecturer });
      setAddInlineNotice(t.ttNeedLecturer);
      return;
    }
    if (!activityCode) {
      setFlash({ kind: "bad", message: t.ttNeedActivity });
      setAddInlineNotice(t.ttNeedActivity);
      return;
    }
    if (!day || !slot) {
      setFlash({ kind: "bad", message: t.ttNeedSlot });
      setAddInlineNotice(t.ttNeedSlot);
      return;
    }
    if (!weeks.trim()) {
      setFlash({ kind: "bad", message: t.ttNeedWeeks });
      setAddInlineNotice(t.ttNeedWeeks);
      return;
    }

    const weekNums = parseWeeks(weeks);
    if (weekNums.length === 0) {
      setFlash({ kind: "bad", message: t.ttNeedWeeks });
      setAddInlineNotice(t.ttNeedWeeks);
      return;
    }
    const outside = weeksOutsideTeaching(weekNums, primaryCalendar);
    if (outside.length) {
      const msg = t.ttWeeksOutside.replace("{weeks}", formatWeeks(outside));
      setFlash({ kind: "bad", message: msg });
      setAddInlineNotice(msg);
      return;
    }
    const holidayHits = noClassHits(weekNums, primaryCalendar);
    if (holidayHits.length) {
      const msg = t.ttWeeksNoClass.replace(
        "{weeks}",
        holidayHits.map((h) => `${h.week} (${h.name})`).join(", "),
      );
      setFlash({ kind: "bad", message: msg });
      setAddInlineNotice(msg);
      return;
    }

    const weeksPattern = formatWeeks(weekNums);

    const { start, end } = splitSlot(slot);
    if (!isAllowedScheduleSlot(timeRules, day, start, end, constraintId)) {
      setFlash({ kind: "bad", message: t.ttSlotNotAllowed });
      setAddInlineNotice(t.ttSlotNotAllowed);
      return;
    }

    const activity =
      activeActivities.find((a) => a.activityCode === activityCode) ?? null;

    // One entry per selected offering × room × lecturer combination is too many.
    // Create one entry per offering, using the first selected room + lecturer.
    const room = selectedRooms[0];
    const lecturer = lecturerIds[0];
    const created: ScheduleEntry[] = [];
    let blocked: string | null = null;

    for (const offering of selectedOfferings) {
      const faculty =
        activeFaculties.find(
          (f) =>
            f.facultyCode.toUpperCase() === offering.facultyCode.toUpperCase(),
        ) ?? activeFaculties.find((f) => facultyCodes.includes(f.facultyCode));

      if (!faculty) continue;

      const candidate = {
        id: `sch-${Date.now()}-${offering.id}`,
        day,
        startTime: start,
        endTime: end,
        roomCode: room.roomCode,
        lecturer,
        moduleCode: offering.moduleCode,
        occurrence: offering.occurrence,
        modOffCode: offering.modOffCode,
        weeks: weeksPattern,
      };

      const clashes = findScheduleClashes(
        candidate,
        [...schedule, ...created],
        timeRules,
      );
      if (clashes.length && !allowClash) {
        const first = clashes[0];
        const label =
          first.kind === "room"
            ? t.ttClashRoom
            : first.kind === "lecturer"
              ? t.ttClashLecturer
              : t.ttClashOccurrence;
        blocked = `${label}: ${first.detail}`;
        break;
      }

      created.push({
        id: candidate.id,
        facultyCode: faculty.facultyCode,
        facultyName: faculty.fullName,
        offeringId: offering.id,
        modOffCode: offering.modOffCode,
        moduleCode: offering.moduleCode,
        moduleName: offering.moduleName,
        occurrence: offering.occurrence,
        activityCode: activity?.activityCode ?? activityCode,
        activityName: activity?.activityName ?? activityCode,
        roomCode: room.roomCode,
        roomName: room.shortName || room.fullName,
        lecturer,
        day,
        slot,
        startTime: start,
        endTime: end,
        weeks: weeksPattern,
        academicYear: offering.academicYear,
        periodSlot: offering.periodSlot,
        createdAt: new Date().toISOString(),
      });
    }

    if (blocked) {
      setFlash({ kind: "bad", message: blocked });
      setAddInlineNotice(blocked);
      return;
    }
    if (created.length === 0) {
      setFlash({ kind: "bad", message: t.ttNeedOffering });
      setAddInlineNotice(t.ttNeedOffering);
      return;
    }

    setSchedule((prev) => [...created, ...prev]);
    pushAudit(
      allowClash ? "TT_ADD_ALLOW_CLASH" : "TT_ADD",
      `Scheduled ${created.length} slot(s) ${day} ${slot} @ ${room.roomCode}${allowClash ? " (clash allowed)" : ""}`,
    );
    setFlash({
      kind: "ok",
      message: allowClash
        ? t.ttAddedWithClash.replace("{n}", String(created.length))
        : t.ttAddedMulti.replace("{n}", String(created.length)),
    });
    setAddInlineNotice(null);
    setSlot("");
  }

  function removeEntry(id: string) {
    const row = schedule.find((s) => s.id === id);
    if (!row) return;
    archiveScheduleEntries([row], "remove");
    setSchedule((prev) => prev.filter((s) => s.id !== id));
    pushAudit("TT_REMOVE", `Removed ${row.modOffCode} ${row.day} ${row.slot}`);
    setFlash({ kind: "ok", message: t.ttRemoved });
  }

  function exitBoardSelectMode() {
    setBoardSelectMode(false);
    setBoardSelectedIds(new Set());
    setConfirmBulkRemove(false);
  }

  function toggleBoardSelection(id: string) {
    setBoardSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllBoardEntries() {
    setBoardSelectedIds(new Set(boardEntries.map((e) => e.id)));
  }

  function removeSelectedEntries() {
    const ids = boardSelectedIds;
    const count = ids.size;
    if (count === 0) return;
    const rows = schedule.filter((s) => ids.has(s.id));
    archiveScheduleEntries(rows, "bulk_remove");
    setSchedule((prev) => prev.filter((s) => !ids.has(s.id)));
    pushAudit("TT_BULK_REMOVE", `Removed ${count} timetable slot(s)`);
    setFlash({
      kind: "ok",
      message: t.ttBulkRemoved.replace("{n}", String(count)),
    });
    exitBoardSelectMode();
  }

  function doClear() {
    archiveScheduleEntries(schedule, "clear_all");
    setSchedule(clearSchedule());
    pushAudit("TT_CLEAR", "Cleared all timetable entries");
    setFlash({ kind: "ok", message: t.ttCleared });
    setConfirmClear(false);
  }

  function downloadTemplate() {
    const a = document.createElement("a");
    a.href = "/templates/timetable-import-template.csv";
    a.download = "timetable-import-template.csv";
    a.click();
  }

  async function onImportFileSelected(file: File | null) {
    if (!file) return;
    try {
      const table = await readImportTable(file);
      const preview = buildImportPreview(
        table,
        file.name,
        schedule,
        {
          faculties,
          rooms,
          activities,
          offeringGroups,
          timeRules,
          calendars,
          preferredCalendars: selectedCalendars,
        },
        {
          missingColumn: (column) =>
            t.ttImportMissingColumn.replace("{column}", column),
          missingWeeksOrDate: () => t.ttImportMissingWeeksOrDate,
          missingField: (field, line) =>
            t.ttImportMissingField
              .replace("{field}", field)
              .replace("{line}", String(line)),
          invalidDay: (line) =>
            t.ttImportInvalidDay.replace("{line}", String(line)),
          invalidTime: (line) =>
            t.ttImportInvalidTime.replace("{line}", String(line)),
          invalidDate: (line) =>
            t.ttImportInvalidDate.replace("{line}", String(line)),
          invalidWeek: (line) =>
            t.ttImportInvalidWeek.replace("{line}", String(line)),
          dateOutsideCalendar: (line) =>
            t.ttImportDateOutsideCalendar.replace("{line}", String(line)),
          noCalendarForRow: (line) =>
            t.ttImportNoCalendarForRow.replace("{line}", String(line)),
          dayDateMismatch: (line) =>
            t.ttImportDayDateMismatch.replace("{line}", String(line)),
          mergedSessions: (from, to, count, weeks) =>
            t.ttImportMergedSessions
              .replace("{from}", String(from))
              .replace("{to}", String(to))
              .replace("{count}", String(count))
              .replace("{weeks}", weeks),
          mergedSummary: (sourceRows, slots) =>
            t.ttImportMergedSummary
              .replace("{source}", String(sourceRows))
              .replace("{slots}", String(slots)),
          unknownFaculty: (code, line) =>
            t.ttImportUnknownFaculty
              .replace("{code}", code)
              .replace("{line}", String(line)),
          unknownRoom: (code, line) =>
            t.ttImportUnknownRoom
              .replace("{code}", code)
              .replace("{line}", String(line)),
          unknownActivity: (code, line) =>
            t.ttImportUnknownActivity
              .replace("{code}", code)
              .replace("{line}", String(line)),
          unknownOffering: (code, line) =>
            t.ttImportUnknownOffering
              .replace("{code}", code)
              .replace("{line}", String(line)),
          invalidSlot: (day, slot, line) =>
            t.ttImportInvalidSlot
              .replace("{day}", day)
              .replace("{slot}", slot)
              .replace("{line}", String(line)),
          clash: (detail, line) =>
            t.ttImportClash
              .replace("{detail}", detail)
              .replace("{line}", String(line)),
        },
      );
      setImportMode("merge");
      setImportPreview(preview);
    } catch (error) {
      const message =
        error instanceof Error && error.message === "UNSUPPORTED_FORMAT"
          ? t.ttImportUnsupported
          : t.ttImportFailed;
      setFlash({ kind: "bad", message });
    }
  }

  function closeImportDialog() {
    if (importing) return;
    setImportPreview(null);
  }

  const effectiveImportReady = useMemo(() => {
    if (!importPreview) return [];
    if (allowImportClashes) return importPreview.ready;
    const clashEntryIds = new Set(
      importPreview.rows
        .filter((r) => r.hasClash && r.entry)
        .map((r) => r.entry!.id),
    );
    return importPreview.ready.filter((e) => !clashEntryIds.has(e.id));
  }, [importPreview, allowImportClashes]);

  const clashesBlockedCount = useMemo(() => {
    if (!importPreview) return 0;
    return Math.max(0, importPreview.ready.length - effectiveImportReady.length);
  }, [importPreview, effectiveImportReady]);

  function confirmImport() {
    if (!importPreview || effectiveImportReady.length === 0) return;
    setImporting(true);
    if (importMode === "replace" && schedule.length > 0) {
      archiveScheduleEntries(schedule, "clear_all");
    }
    const next =
      importMode === "replace"
        ? effectiveImportReady
        : [...effectiveImportReady, ...schedule];
    setSchedule(next);
    pushAudit(
      "TT_IMPORT",
      `${importMode === "replace" ? "Replaced" : "Merged"} ${effectiveImportReady.length} slot(s) from ${importPreview.fileName}${allowImportClashes ? " (clash allowed)" : ""}`,
    );
    setFlash({
      kind: "ok",
      message: t.ttImportDone.replace("{n}", String(effectiveImportReady.length)),
    });
    setImporting(false);
    setImportPreview(null);
  }

  function exportCsv() {
    const csv = scheduleToCsv(boardEntries);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timetable-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushAudit("TT_EXPORT", `Exported ${boardEntries.length} timetable rows`);
    setFlash({ kind: "ok", message: t.ttExported });
  }

  return (
    <>
      <FlashBanner />

      <section className="hero-panel tt-hero">
        <div>
          <h1>{t.ttTitle}</h1>
          <p>{t.ttLede}</p>
        </div>
        <div className="meter">
          <strong>{schedule.length}</strong>
          <span>{t.ttMeter}</span>
        </div>
      </section>

      {!paramListsReady ? (
        <div className="panel">
          <p className="lead">{t.paramLoading}</p>
        </div>
      ) : (
        <div className="tt-layout">
          <div className="panel tt-compose">
            <h2>{t.ttCompose}</h2>
            <p className="lead">{t.ttComposeLede}</p>
            <p className="tt-multi-hint">{t.ttMultiHint}</p>

            <ol className="tt-steps">
              <li className={stepsReady[1] ? "done" : "current"}>
                <div className="tt-step-head">
                  <span className="tt-step-num">1</span>
                  <span>{t.ttCalendar}</span>
                </div>
                <SelectedChips
                  items={selectedCalendars.map((c) => ({
                    id: c.id,
                    label: `${c.academicYear} · ${c.semester}`,
                  }))}
                  onRemove={(id) => onToggleCalendar(id)}
                />
                <SearchField
                  value={calendarDraft}
                  applied={calendarQuery}
                  placeholder={t.ttCalendarPh}
                  searchLabel={t.ttSearch}
                  onChange={setCalendarDraft}
                  onSearch={() => setCalendarQuery(calendarDraft.trim())}
                  onClear={() => {
                    setCalendarDraft("");
                    setCalendarQuery("");
                  }}
                />
                <SuggestList
                  key={`cal-${calendarQuery}`}
                  items={calendarMatches}
                  selectedIds={calendarIds}
                  empty={t.ttNoCalendar}
                  onToggle={(c) => onToggleCalendar(c.id)}
                  render={(c) => ({
                    title: `${c.academicYear} · ${c.semester}`,
                    sub: `weeks ${c.teachingWeeksStart}-${c.teachingWeeksEnd}${c.isActive ? ` · ${t.calActiveBadge}` : ""}`,
                  })}
                />
              </li>

              <li
                className="current"
              >
                <div className="tt-step-head">
                  <span className="tt-step-num">2</span>
                  <span>{t.ttFaculty}</span>
                </div>
                <SelectedChips
                  items={activeFaculties
                    .filter((f) => facultyCodes.includes(f.facultyCode))
                    .map((f) => ({
                      id: f.facultyCode,
                      label: `${f.facultyCode} · ${f.shortName}`,
                    }))}
                  onRemove={(id) => toggleFaculty(id)}
                />
                <SearchField
                  value={facultyDraft}
                  applied={facultyQuery}
                  placeholder={t.ttFacultyPh}
                  searchLabel={t.ttSearch}
                  disabled={false}
                  onChange={setFacultyDraft}
                  onSearch={() => setFacultyQuery(facultyDraft.trim())}
                  onClear={() => {
                    setFacultyDraft("");
                    setFacultyQuery("");
                  }}
                />
                <SuggestList
                  key={`fac-${facultyQuery}`}
                  items={facultyMatches}
                  selectedIds={facultyCodes}
                  empty={t.ttNoFaculty}
                  getId={(f) => f.facultyCode}
                  onToggle={(f) => toggleFaculty(f.facultyCode)}
                  render={(f) => ({
                    title: f.facultyCode,
                    sub: f.shortName,
                  })}
                />
              </li>

              <li
                className="current"
              >
                <div className="tt-step-head">
                  <span className="tt-step-num">3</span>
                  <span>
                    {t.ttModule}
                    {stepsReady[2]
                      ? ` · ${facultyModules.length} ${t.ttAvailable}`
                      : ""}
                  </span>
                </div>
                <SelectedChips
                  items={selectedModules.map((m) => ({
                    id: m.id,
                    label: m.moduleCode,
                    sub: m.moduleEngDesc,
                  }))}
                  onRemove={(id) => {
                    setModuleIds((prev) => prev.filter((x) => x !== id));
                    setOfferingIds([]);
                  }}
                />
                <SearchField
                  value={moduleDraft}
                  applied={moduleQuery}
                  placeholder={t.ttModulePh}
                  searchLabel={t.ttSearch}
                  disabled={false}
                  onChange={setModuleDraft}
                  onSearch={() => setModuleQuery(moduleDraft.trim())}
                  onClear={() => {
                    setModuleDraft("");
                    setModuleQuery("");
                  }}
                />
                <SuggestList
                  key={`mod-${facultyCodes.join(",")}-${moduleQuery}`}
                  items={moduleMatches}
                  selectedIds={moduleIds}
                  empty={t.ttNoModule}
                  onToggle={toggleModule}
                  render={(m) => ({
                    title: m.moduleCode,
                    sub: m.moduleEngDesc,
                  })}
                />
              </li>

              <li
                className="current"
              >
                <div className="tt-step-head">
                  <span className="tt-step-num">4</span>
                  <span>
                    {t.ttOffering}
                    {stepsReady[3]
                      ? ` · ${facultyOfferings.length} ${t.ttAvailable}`
                      : ""}
                  </span>
                </div>
                <SelectedChips
                  items={selectedOfferings.map((o) => ({
                    id: o.id,
                    label: o.modOffCode,
                    sub: o.moduleName,
                  }))}
                  onRemove={(id) =>
                    setOfferingIds((prev) => prev.filter((x) => x !== id))
                  }
                />
                <SearchField
                  value={offeringDraft}
                  applied={offeringQuery}
                  placeholder={t.ttOfferingPh}
                  searchLabel={t.ttSearch}
                  disabled={false}
                  onChange={setOfferingDraft}
                  onSearch={() => setOfferingQuery(offeringDraft.trim())}
                  onClear={() => {
                    setOfferingDraft("");
                    setOfferingQuery("");
                  }}
                />
                <SuggestList
                  key={`off-${moduleIds.join(",")}-${offeringQuery}`}
                  items={offeringMatches}
                  selectedIds={offeringIds}
                  empty={t.ttNoOffering}
                  onToggle={toggleOffering}
                  render={(o) => ({
                    title: o.modOffCode,
                    sub: `occ ${o.occurrence} · ${o.periodSlot} · target ${o.targetNoStudents}`,
                  })}
                />
              </li>

              <li
                className="current"
              >
                <div className="tt-step-head">
                  <span className="tt-step-num">5</span>
                  <span className="tt-step-title">
                    {t.ttRoom}
                    {stepsReady[2]
                      ? ` · ${displayRooms.length} ${t.ttAvailable}`
                      : ""}
                  </span>
                  {facultySet.size > 0 && (
                    <button
                      type="button"
                      className={`tt-scope-btn${roomShowAll ? " on" : ""}`}
                      onClick={() => setRoomShowAll((v) => !v)}
                    >
                      {roomShowAll ? t.ttShowFacultyOnly : t.ttShowAll}
                    </button>
                  )}
                </div>
                <SelectedChips
                  items={selectedRooms.map((r) => ({
                    id: r.roomCode,
                    label: r.roomCode,
                    sub: r.shortName || r.fullName,
                  }))}
                  onRemove={(id) =>
                    setRoomCodes((prev) => prev.filter((x) => x !== id))
                  }
                />
                <SearchField
                  value={roomDraft}
                  applied={roomQuery}
                  placeholder={t.ttRoomPh}
                  searchLabel={t.ttSearch}
                  disabled={false}
                  onChange={setRoomDraft}
                  onSearch={() => setRoomQuery(roomDraft.trim())}
                  onClear={() => {
                    setRoomDraft("");
                    setRoomQuery("");
                  }}
                />
                <SuggestList
                  key={`room-${facultyCodes.join(",")}-${roomShowAll}-${roomQuery}`}
                  items={roomMatches}
                  selectedIds={roomCodes}
                  empty={roomShowAll ? t.ttNoRoomAll : t.ttNoRoom}
                  getId={(r) => r.roomCode}
                  onToggle={toggleRoom}
                  render={(r) => ({
                    title: r.roomCode,
                    sub: `${r.shortName || r.fullName} · ${r.buildingCode} · ${r.maximumSeats} seats`,
                  })}
                />
              </li>

              <li
                className="current"
              >
                <div className="tt-step-head">
                  <span className="tt-step-num">6</span>
                  <span className="tt-step-title">
                    {t.ttLecturer}
                    {stepsReady[2]
                      ? ` · ${displayLecturers.length} ${t.ttAvailable}`
                      : ""}
                  </span>
                  {facultySet.size > 0 && (
                    <button
                      type="button"
                      className={`tt-scope-btn${lecturerShowAll ? " on" : ""}`}
                      onClick={() => setLecturerShowAll((v) => !v)}
                    >
                      {lecturerShowAll ? t.ttShowFacultyOnly : t.ttShowAll}
                    </button>
                  )}
                </div>
                <SelectedChips
                  items={lecturerIds.map((id) => ({
                    id,
                    label: lecturerLabelById.get(id) ?? id,
                  }))}
                  onRemove={(id) => toggleLecturer(id)}
                />
                <SearchField
                  value={lecturerDraft}
                  applied={lecturerQuery}
                  placeholder={t.ttLecturerPh}
                  searchLabel={t.ttSearch}
                  disabled={false}
                  onChange={setLecturerDraft}
                  onSearch={() => setLecturerQuery(lecturerDraft.trim())}
                  onClear={() => {
                    setLecturerDraft("");
                    setLecturerQuery("");
                  }}
                />
                <SuggestList
                  key={`lec-${facultyCodes.join(",")}-${lecturerShowAll}-${lecturerQuery}`}
                  items={lecturerMatches}
                  selectedIds={lecturerIds}
                  empty={lecturerShowAll ? t.ttNoLecturerAll : t.ttNoLecturer}
                  onToggle={(lec) => toggleLecturer(lec.id)}
                  render={(lec) => ({
                    title: lec.label,
                    sub: lec.id,
                  })}
                />
                <p className="tt-step-hint">{t.ttLecturerHint}</p>
              </li>
            </ol>

            {contextReady ? (
              <div className="tt-schedule-more">
                <h3>{t.ttScheduleDetails}</h3>
                <p className="lead">{t.ttScheduleDetailsLede}</p>
                <p className="tt-step-hint">
                  {t.ttAddMultiHint
                    .replace("{offerings}", String(selectedOfferings.length))
                    .replace("{room}", selectedRooms[0]?.roomCode ?? "—")
                    .replace("{lecturer}", lecturerIds[0] ?? "—")}
                </p>

                <div className="field">
                  <label htmlFor="tt-act">{t.ttActivity}</label>
                  <select
                    id="tt-act"
                    value={activityCode}
                    onChange={(e) => setActivityCode(e.target.value)}
                  >
                    <option value="">{t.ttPickActivity}</option>
                    {activeActivities.map((a) => (
                      <option key={a.id} value={a.activityCode}>
                        {a.activityCode} — {a.activityName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="tt-constraint">{t.ttConstraint}</label>
                  <select
                    id="tt-constraint"
                    value={constraintId}
                    onChange={(e) => {
                      setConstraintId(e.target.value);
                      setSlot("");
                    }}
                  >
                    <option value="">{t.ttPickConstraint}</option>
                    {enabledConstraints.map((c) => (
                      <option key={c.id} value={c.id} title={c.summary}>
                        {constraintPickerLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="tt-day">{t.ttDay}</label>
                    <select
                      id="tt-day"
                      value={day}
                      onChange={(e) => onPickDay(e.target.value)}
                    >
                      <option value="">{t.ttPickDay}</option>
                      {schedulableDays.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="tt-slot">{t.ttSlot}</label>
                    <select
                      id="tt-slot"
                      value={slot}
                      disabled={!day}
                      onChange={(e) => setSlot(e.target.value)}
                    >
                      <option value="">{t.ttPickSlot}</option>
                      {daySlots.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="tt-weeks">{t.ttWeeks}</label>
                  <p className="tt-step-hint">{t.ttWeeksHint}</p>
                  <div className="tt-week-picks" role="group" aria-label={t.ttWeeks}>
                    {(weekOptions.length ? weekOptions : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]).map(
                      (w) => {
                        const blocked = noClassMap.get(w);
                        const on = selectedWeekNums.includes(w);
                        return (
                          <button
                            key={w}
                            type="button"
                            className={`tt-week-pick${on ? " on" : ""}${blocked ? " noclss" : ""}`}
                            title={blocked ? `${t.ttWeekNoClass}: ${blocked}` : `Week ${w}`}
                            onClick={() => toggleWeek(w)}
                          >
                            {w}
                          </button>
                        );
                      },
                    )}
                  </div>
                  <div className="tt-week-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setWeeks(
                          formatWeeks(
                            (weekOptions.length ? weekOptions : []).filter(
                              (w) => !noClassMap.has(w),
                            ),
                          ),
                        )
                      }
                    >
                      {t.ttWeeksAllTeach}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setWeeks("")}
                    >
                      {t.ttWeeksNone}
                    </button>
                  </div>
                  <input
                    id="tt-weeks"
                    value={weeks}
                    onChange={(e) => setWeeks(e.target.value)}
                    placeholder="1-7,9-14"
                  />
                </div>

                <div className="tt-addbar">
                  <div className="toolbar" style={{ marginTop: "0.5rem" }}>
                  <button type="button" className="btn" onClick={addEntry}>
                    {t.ttAdd}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-ghost btn-sm${allowClash ? " tt-allow-clash-on" : ""}`}
                    onClick={() => setAllowClash((v) => !v)}
                  >
                    {allowClash ? t.ttAllowClashOn : t.ttAllowClash}
                  </button>
                  {addInlineNotice ? (
                    <span className="tt-inline-bad">{addInlineNotice}</span>
                  ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <p className="tt-step-hint">{t.ttCompleteSteps}</p>
            )}
          </div>

          <div className="panel tt-board">
            <div className="tt-board-head">
              <div>
                <h2>{t.ttBoard}</h2>
                <p className="lead">{t.ttBoardLede}</p>
              </div>
              <div className="toolbar">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    boardSelectMode
                      ? exitBoardSelectMode()
                      : setBoardSelectMode(true)
                  }
                  disabled={boardEntries.length === 0}
                >
                  {boardSelectMode ? t.ttSelectCancel : t.ttSelectRemove}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={downloadTemplate}
                >
                  {t.ttImportTemplate}
                </button>
                <label className="btn btn-ghost btn-sm tt-import-btn">
                  {t.ttImport}
                  <input
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls"
                    hidden
                    onChange={(e) => {
                      void onImportFileSelected(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={exportCsv}
                  disabled={boardEntries.length === 0}
                >
                  {t.ttExport}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setConfirmClear(true)}
                  disabled={schedule.length === 0}
                >
                  {t.ttClear}
                </button>
              </div>
            </div>

            {boardSelectMode ? (
              <div className="tt-board-selectbar">
                <span className="tt-board-selectcount">
                  {t.ttSelectedCount.replace(
                    "{n}",
                    String(boardSelectedIds.size),
                  )}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={selectAllBoardEntries}
                  disabled={boardEntries.length === 0}
                >
                  {t.ttSelectAll}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setBoardSelectedIds(new Set())}
                  disabled={boardSelectedIds.size === 0}
                >
                  {t.ttClearSelection}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setConfirmBulkRemove(true)}
                  disabled={boardSelectedIds.size === 0}
                >
                  {t.ttDeleteSelected}
                </button>
              </div>
            ) : null}

            <p className="lead" style={{ marginBottom: "0.85rem" }}>
              {boardSelectMode
                ? t.ttSelectHint
                : !boardScopeReady
                  ? t.ttBoardNeedScope
                  : t.ttCount.replace("{n}", String(displayEntries.length))}
            </p>

            <WeekTimetableGrid
              entries={displayEntries}
              days={gridDays}
              emptyLabel={
                !boardScopeReady ? t.ttBoardNeedScope : t.ttEmpty
              }
              removeLabel={t.ttRemove}
              onRemove={removeEntry}
              onBlockClick={(sources) => setDetailEntries(sources)}
              warnIds={boardWithPreview.warnIds}
              previewIds={boardWithPreview.previewIds}
              removableIds={removableIds}
              selectMode={boardSelectMode}
              selectedIds={boardSelectedIds}
              selectableIds={removableIds}
              onToggleSelect={toggleBoardSelection}
            />

            <div className="tt-cancel-panel">
              <button
                type="button"
                className="tt-cancel-toggle"
                onClick={() => setCancelListOpen((open) => !open)}
                aria-expanded={cancelListOpen}
              >
                <span>
                  {t.ttCancelHistory}
                  {calendarIds.length > 0
                    ? ` · ${visibleCancelled.length}`
                    : ""}
                </span>
                <span className="tt-cancel-chevron" aria-hidden>
                  {cancelListOpen ? "▾" : "▸"}
                </span>
              </button>
              {cancelListOpen ? (
                <div className="tt-cancel-body">
                  <p className="lead">{t.ttCancelHistoryLede}</p>
                  {visibleCancelled.length === 0 ? (
                    <div className="empty-note">
                      {calendarIds.length === 0
                        ? t.ttCancelPickCalendar
                        : t.ttCancelEmptyCalendar}
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table className="data-table tt-cancel-table">
                        <thead>
                          <tr>
                            <th>{t.ttCancelWhen}</th>
                            <th>{t.ttCancelOffering}</th>
                            <th>{t.ttDay}</th>
                            <th>{t.ttSlot}</th>
                            <th>{t.ttRoom}</th>
                            <th>{t.ttLecturer}</th>
                            <th>{t.ttWeeks}</th>
                            <th>{t.auditAction}</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {visibleCancelled.map((row) => (
                            <tr key={row.cancelId}>
                              <td>
                                {new Date(row.cancelledAt).toLocaleString()}
                              </td>
                              <td>
                                <strong>{row.entry.modOffCode}</strong>
                                <div className="tt-cancel-sub">
                                  {row.entry.facultyCode}
                                </div>
                              </td>
                              <td>{row.entry.day}</td>
                              <td>{row.entry.slot}</td>
                              <td>{row.entry.roomCode}</td>
                              <td>{row.entry.lecturer || "—"}</td>
                              <td>w{row.entry.weeks}</td>
                              <td>{cancelReasonLabel(row.reason)}</td>
                              <td className="tt-cancel-actions">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => restoreCancelled(row.cancelId)}
                                >
                                  {t.ttCancelRestore}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setPurgeCancelId(row.cancelId)}
                                >
                                  {t.ttCancelPurge}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <ScheduleImportDialog
        open={importPreview !== null}
        preview={importPreview}
        mode={importMode}
        importing={importing}
        allowClashes={allowImportClashes}
        onAllowClashes={setAllowImportClashes}
        effectiveReadyCount={effectiveImportReady.length}
        clashesBlockedCount={clashesBlockedCount}
        labels={{
          title: t.ttImportTitle,
          lede: t.ttImportLede,
          file: t.ttImportFile,
          mode: t.ttImportMode,
          allowClashes: t.ttImportAllowClashes,
          clashBlocked: t.ttImportClashBlocked,
          modeMerge: t.ttImportModeMerge,
          modeReplace: t.ttImportModeReplace,
          summary: t.ttImportMore,
          ready: t.ttImportReady,
          warnings: t.ttImportWarnings,
          errors: t.ttImportErrors,
          line: t.ttImportLine,
          status: t.ttImportStatus,
          detail: t.ttImportDetail,
          offering: t.ttOffering,
          noRows: t.ttImportNoRows,
          import: t.ttImportConfirm,
          cancel: t.sysCancel,
          downloadErrors: t.ttImportDownloadErrors,
          statusOk: t.ttImportStatusOk,
          statusWarning: t.ttImportStatusWarning,
          statusError: t.ttImportStatusError,
        }}
        onModeChange={setImportMode}
        onCancel={closeImportDialog}
        onConfirm={confirmImport}
      />

      <ScheduleDetailDialog
        open={detailEntries !== null}
        entries={detailEntries ?? []}
        calendars={calendars}
        labels={{
          title: t.ttDetailTitle,
          close: t.sysCancel,
          day: t.ttDay,
          time: t.ttDetailTime,
          faculty: t.ttFaculty,
          module: t.ttModule,
          moduleName: t.ttDetailModuleName,
          offering: t.ttOffering,
          activity: t.ttActivity,
          lecturer: t.ttLecturer,
          room: t.ttRoom,
          weeks: t.ttWeeks,
          academicYear: t.ttDetailYear,
          period: t.ttDetailPeriod,
          meetings: t.ttDetailMeetings,
          teachingDates: t.ttDetailTeachingDates,
          noDates: t.ttDetailNoDates,
        }}
        onClose={() => setDetailEntries(null)}
      />

      <ConfirmDialog
        open={confirmClear}
        title={t.ttClearTitle}
        body={t.ttClearBody}
        confirmLabel={t.ttClear}
        cancelLabel={t.sysCancel}
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={doClear}
      />

      <ConfirmDialog
        open={confirmBulkRemove}
        title={t.ttBulkRemoveTitle}
        body={t.ttBulkRemoveBody.replace(
          "{n}",
          String(boardSelectedIds.size),
        )}
        confirmLabel={t.ttDeleteSelected}
        cancelLabel={t.sysCancel}
        danger
        onCancel={() => setConfirmBulkRemove(false)}
        onConfirm={removeSelectedEntries}
      />

      <ConfirmDialog
        open={purgeCancelId !== null}
        title={t.ttCancelPurgeTitle}
        body={t.ttCancelPurgeBody}
        confirmLabel={t.ttCancelPurge}
        cancelLabel={t.sysCancel}
        danger
        onCancel={() => setPurgeCancelId(null)}
        onConfirm={confirmPurgeCancelled}
      />
    </>
  );
}
