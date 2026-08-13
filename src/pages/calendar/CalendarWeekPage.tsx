import { useMemo, useState } from "react";
import { CalendarSearchBar } from "../../components/CalendarSearchBar";
import { FlashBanner } from "../../components/FlashBanner";
import { ScheduleDetailDialog } from "../../components/ScheduleDetailDialog";
import { WeekTimetableGrid } from "../../components/WeekTimetableGrid";
import { useLanguage } from "../../i18n/LanguageContext";
import { findScheduleClashes } from "../../lib/clashDetection";
import {
  filterScheduleByCriteria,
  searchParameterResults,
  type CalendarCriterion,
  type CalendarSearchField,
  type CalendarSearchSuggestion,
} from "../../lib/calendarSearch";
import { useStore } from "../../state/StoreContext";
import type { ScheduleEntry } from "../../types";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function daySortKey(day: string): number {
  const idx = DAY_ORDER.findIndex(
    (d) => d.toLowerCase() === day.slice(0, 3).toLowerCase(),
  );
  return idx === -1 ? 99 : idx;
}

export function CalendarWeekPage() {
  const { t } = useLanguage();
  const { schedule, timeRules, calendars } = useStore();
  const [searchField, setSearchField] = useState<CalendarSearchField>("faculty");
  const [searchDraft, setSearchDraft] = useState("");
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<CalendarSearchSuggestion[]>([]);
  const [criteria, setCriteria] = useState<CalendarCriterion[]>([]);
  const [appliedCriteria, setAppliedCriteria] = useState<CalendarCriterion[]>(
    [],
  );
  const [shown, setShown] = useState(false);
  const [detailEntries, setDetailEntries] = useState<ScheduleEntry[] | null>(
    null,
  );

  const filtered = useMemo(() => {
    if (!shown) return [] as typeof schedule;
    const list = filterScheduleByCriteria(schedule, appliedCriteria);
    return [...list].sort((a, b) => {
      const dayDiff = daySortKey(a.day) - daySortKey(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [schedule, appliedCriteria, shown]);

  const warnIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of filtered) {
      const clashes = findScheduleClashes(row, filtered, timeRules);
      if (!clashes.length) continue;
      ids.add(row.id);
      for (const hit of clashes) ids.add(hit.againstId);
    }
    return ids;
  }, [filtered, timeRules]);

  const gridDays = useMemo(() => {
    const set = new Set(
      filtered.map((row) => {
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
  }, [filtered]);

  function fieldLabel(field: CalendarSearchField): string {
    switch (field) {
      case "any":
        return t.calSearchAny;
      case "faculty":
        return t.ttFaculty;
      case "module":
        return t.ttModule;
      case "offering":
        return t.ttOffering;
      case "room":
        return t.ttRoom;
      case "lecturer":
        return t.ttLecturer;
      case "activity":
        return t.ttActivity;
      case "day":
        return t.ttDay;
      case "weeks":
        return t.ttWeeks;
      case "academicYear":
        return t.calSearchYear;
      case "period":
        return t.calSearchPeriod;
      default:
        return field;
    }
  }

  function runSearch() {
    setResults(searchParameterResults(schedule, searchField, searchDraft));
    setSearched(true);
  }

  function addResult(item: CalendarSearchSuggestion) {
    const resolvedField = item.field ?? (searchField === "any" ? "any" : searchField);
    const next: CalendarCriterion = {
      id: `${resolvedField}-${item.value}-${Date.now()}`,
      field: resolvedField,
      value: item.value,
      label: item.label,
    };
    setShown(false);
    setAppliedCriteria([]);
    setCriteria((prev) => {
      const exists = prev.some(
        (c) =>
          c.field === next.field &&
          c.value.trim().toLowerCase() === next.value.trim().toLowerCase(),
      );
      return exists ? prev : [...prev, next];
    });
  }

  function removeCriterion(id: string) {
    setShown(false);
    setAppliedCriteria([]);
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  }

  function clearCriteria() {
    setCriteria([]);
    setAppliedCriteria([]);
    setShown(false);
  }

  function showResults() {
    if (criteria.length === 0) return;
    setAppliedCriteria([...criteria]);
    setShown(true);
  }

  return (
    <>
      <FlashBanner />
      <div className="panel">
        <h2>{t.calWeekTitle}</h2>
        <p className="lead">{t.calWeekLede}</p>

        <CalendarSearchBar
          field={searchField}
          draft={searchDraft}
          results={results}
          searched={searched}
          criteria={criteria}
          shown={shown}
          labels={{
            search: t.calSearch,
            searchBy: t.calSearchBy,
            query: t.calSearchQuery,
            placeholder: t.calSearchPh,
            add: t.calSearchAddHint,
            result: t.calSearchResult,
            criteria: t.calSearchCriteria,
            noResult: t.calSearchNoResult,
            searchFirst: t.calSearchFirst,
            clearCriteria: t.calSearchClear,
            show: t.calSearchShow,
            fieldLabel,
          }}
          onFieldChange={(next) => {
            setSearchField(next);
            setSearched(false);
            setResults([]);
          }}
          onDraftChange={setSearchDraft}
          onSearch={runSearch}
          onClearDraft={() => setSearchDraft("")}
          onAddResult={addResult}
          onRemoveCriterion={removeCriterion}
          onClearCriteria={clearCriteria}
          onShow={showResults}
        />

        <p className="lead" style={{ marginBottom: "0.85rem" }}>
          {!shown
            ? t.calSearchHint
            : t.calCount.replace("{n}", String(filtered.length))}
        </p>

        <WeekTimetableGrid
          entries={filtered}
          days={gridDays}
          emptyLabel={!shown ? t.calSearchHint : t.calSearchNoMatch}
          warnIds={warnIds}
          onBlockClick={(sources) => setDetailEntries(sources)}
        />
      </div>

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
    </>
  );
}
