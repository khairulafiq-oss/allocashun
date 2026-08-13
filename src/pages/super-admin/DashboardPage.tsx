import { useMemo } from "react";
import { FlashBanner } from "../../components/FlashBanner";
import { useLanguage } from "../../i18n/LanguageContext";
import { findScheduleClashes } from "../../lib/clashDetection";
import { noClassWeeks } from "../../lib/weeks";
import { useStore } from "../../state/StoreContext";

export function DashboardPage() {
  const { t } = useLanguage();
  const {
    users,
    faculties,
    rooms,
    activities,
    modules,
    offeringGroups,
    paramListsReady,
    calendars,
    timeRules,
    schedule,
  } = useStore();

  const activeUsers = users.filter((u) => u.active).length;
  const activeFaculties = faculties.filter((f) => f.active).length;
  const activeCalendar =
    calendars.find((c) => c.isActive) ?? calendars[0] ?? null;

  const weekFrom = activeCalendar?.teachingWeeksStart ?? 0;
  const weekTo = activeCalendar?.teachingWeeksEnd ?? 0;
  const weekCount =
    weekFrom && weekTo ? Math.max(0, weekTo - weekFrom + 1) : 0;
  const holidayWeeks = useMemo(
    () => noClassWeeks(activeCalendar),
    [activeCalendar],
  );

  const clashCount = useMemo(() => {
    const ids = new Set<string>();
    for (const row of schedule) {
      const hits = findScheduleClashes(row, schedule, timeRules);
      if (!hits.length) continue;
      ids.add(row.id);
      for (const hit of hits) ids.add(hit.againstId);
    }
    return ids.size;
  }, [schedule, timeRules]);

  const uniqueModules = useMemo(
    () => new Set(schedule.map((r) => r.moduleCode).filter(Boolean)).size,
    [schedule],
  );
  const uniqueRooms = useMemo(
    () => new Set(schedule.map((r) => r.roomCode).filter(Boolean)).size,
    [schedule],
  );
  const uniqueLecturers = useMemo(
    () => new Set(schedule.map((r) => (r.lecturer ?? "").trim()).filter(Boolean)).size,
    [schedule],
  );

  const facultyBoard = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of schedule) {
      const code = row.facultyCode || "—";
      map.set(code, (map.get(code) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [schedule]);

  const slotRuleCount = timeRules.slotRules.reduce(
    (n, rule) => n + rule.slots.length,
    0,
  );

  return (
    <>
      <FlashBanner />
      <section className="hero-panel">
        <div>
          <h1>{t.dashTitle}</h1>
          <p>{t.dashLede}</p>
        </div>
        <div className="meter">
          <strong>{schedule.length}</strong>
          <span>{t.dashMeterSlots}</span>
        </div>
      </section>

      <div className="grid-3">
        <div className="stat-card">
          <div className="label">{t.dashSession}</div>
          <div className="value" style={{ fontSize: "1.15rem" }}>
            {activeCalendar?.academicYear ?? "—"}
            <br />
            <span className="dash-sub">
              {activeCalendar?.semester ?? t.calEmpty}
            </span>
          </div>
          {activeCalendar?.semesterStart ? (
            <p className="dash-meta">
              {activeCalendar.semesterStart} → {activeCalendar.semesterEnd}
            </p>
          ) : null}
        </div>
        <div className="stat-card">
          <div className="label">{t.dashTeachWeeks}</div>
          <div className="value">
            {weekCount || "—"}
            <span className="dash-sub">
              {weekCount ? `${weekFrom}–${weekTo}` : ""}
            </span>
          </div>
          <p className="dash-meta">
            {holidayWeeks.size
              ? t.dashNoClassWeeks.replace("{n}", String(holidayWeeks.size))
              : t.dashNoBreaks}
          </p>
        </div>
        <div className="stat-card">
          <div className="label">{t.dashClashes}</div>
          <div className="value">{clashCount}</div>
          <p className="dash-meta">
            {clashCount ? t.dashClashHint : t.dashClashClear}
          </p>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: "0.85rem" }}>
        <div className="stat-card">
          <div className="label">{t.dashFaculties}</div>
          <div className="value">
            {activeFaculties}
            <span className="dash-sub">/ {faculties.length}</span>
          </div>
          <p className="dash-meta">{t.dashFacultiesHint}</p>
        </div>
        <div className="stat-card">
          <div className="label">{t.dashActiveUsers}</div>
          <div className="value">
            {activeUsers}
            <span className="dash-sub">/ {users.length}</span>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: "1rem" }}>
        <div className="panel">
          <h2 style={{ fontSize: "1.2rem" }}>{t.dashBoardMix}</h2>
          <p className="lead">{t.dashBoardMixLede}</p>
          <div className="dash-kv">
            <span>{t.dashModulesOnBoard}</span>
            <strong>{uniqueModules}</strong>
            <span>{t.dashRoomsOnBoard}</span>
            <strong>{uniqueRooms}</strong>
            <span>{t.dashLecturersOnBoard}</span>
            <strong>{uniqueLecturers}</strong>
          </div>
          {facultyBoard.length === 0 ? (
            <p className="tt-step-hint">{t.dashNoSchedule}</p>
          ) : (
            <ul className="dash-list">
              {facultyBoard.map(([code, n]) => (
                <li key={code}>
                  <span>{code}</span>
                  <strong>{n}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <h2 style={{ fontSize: "1.2rem" }}>{t.dashParams}</h2>
          <p className="lead">
            {paramListsReady ? t.dashParamsReady : t.paramLoading}
          </p>
          <div className="dash-kv">
            <span>{t.dashParamRooms}</span>
            <strong>{rooms.filter((r) => r.inUse).length}</strong>
            <span>{t.dashParamActivities}</span>
            <strong>{activities.filter((a) => a.inUse).length}</strong>
            <span>{t.dashParamModules}</span>
            <strong>{modules.filter((m) => m.active).length}</strong>
            <span>{t.dashParamOfferings}</span>
            <strong>{offeringGroups.filter((o) => o.active).length}</strong>
          </div>
          <h3 className="dash-h3">{t.dashTimeRules}</h3>
          <p className="dash-meta" style={{ marginTop: 0 }}>
            {t.dashSlotRules
              .replace("{rules}", String(timeRules.slotRules.length))
              .replace("{slots}", String(slotRuleCount))}
          </p>
          <div className="dash-flags">
            <span className={`badge ${timeRules.clashRoom ? "badge-ok" : "badge-off"}`}>
              {t.dashClashRoom}: {timeRules.clashRoom ? t.dashOn : t.dashOff}
            </span>
            <span className={`badge ${timeRules.clashLecturer ? "badge-ok" : "badge-off"}`}>
              {t.dashClashLec}: {timeRules.clashLecturer ? t.dashOn : t.dashOff}
            </span>
            <span className={`badge ${timeRules.clashOccurrence ? "badge-ok" : "badge-off"}`}>
              {t.dashClashOcc}: {timeRules.clashOccurrence ? t.dashOn : t.dashOff}
            </span>
          </div>
        </div>
      </div>

    </>
  );
}
