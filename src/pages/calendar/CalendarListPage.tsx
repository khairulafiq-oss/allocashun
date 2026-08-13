import { useMemo, useState } from "react";
import { CalendarSearchBar } from "../../components/CalendarSearchBar";
import { FlashBanner } from "../../components/FlashBanner";
import { ScheduleDetailDialog } from "../../components/ScheduleDetailDialog";
import { useLanguage } from "../../i18n/LanguageContext";
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

export function CalendarListPage() {
  const { t } = useLanguage();
  const { schedule, calendars } = useStore();
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

  const rows = useMemo(() => {
    if (!shown) return [] as typeof schedule;
    const list = filterScheduleByCriteria(schedule, appliedCriteria);
    return [...list].sort((a, b) => {
      const dayDiff = daySortKey(a.day) - daySortKey(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [schedule, appliedCriteria, shown]);

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
        <h2>{t.calListTitle}</h2>
        <p className="lead">{t.calListLede}</p>

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
            : t.calCount.replace("{n}", String(rows.length))}
        </p>

        {!shown ? (
          <div className="empty-note">{t.calSearchHint}</div>
        ) : rows.length === 0 ? (
          <div className="empty-note">{t.calSearchNoMatch}</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t.ttDay}</th>
                  <th>{t.ttSlot}</th>
                  <th>{t.ttOffering}</th>
                  <th>{t.ttModule}</th>
                  <th>{t.ttActivity}</th>
                  <th>{t.ttRoom}</th>
                  <th>{t.ttLecturer}</th>
                  <th>{t.ttWeeks}</th>
                  <th>{t.ttFaculty}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="tt-list-row-clickable"
                    onClick={() => setDetailEntries([row])}
                  >
                    <td>
                      <span className="badge">{row.day}</span>
                    </td>
                    <td>{row.slot}</td>
                    <td>{row.modOffCode}</td>
                    <td>
                      {row.moduleCode}
                      {row.moduleName ? ` — ${row.moduleName}` : ""}
                    </td>
                    <td>{row.activityName || row.activityCode}</td>
                    <td>{row.roomCode}</td>
                    <td>{row.lecturer || "—"}</td>
                    <td>{row.weeks}</td>
                    <td>{row.facultyCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
