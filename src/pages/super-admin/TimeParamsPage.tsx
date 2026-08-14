import { useState } from "react";
import { FlashBanner } from "../../components/FlashBanner";
import { useLanguage } from "../../i18n/LanguageContext";
import { ensureConstraints } from "../../lib/scheduleConstraints";
import { generateTimeSlots, formatSlotDayLabel, excludeOverlappingSlots } from "../../lib/timeSlots";
import { teachingWeekSpanFromDates } from "../../lib/weeks";
import { useStore } from "../../state/StoreContext";
import type {
  AcademicCalendar,
  CalendarBreak,
  ScheduleConstraint,
  TimeRules,
  TimeSlotRule,
  TimeWindow,
} from "../../types";

const DAY_KEYS = [
  { id: "Mon", label: "dayMon" },
  { id: "Tue", label: "dayTue" },
  { id: "Wed", label: "dayWed" },
  { id: "Thu", label: "dayThu" },
  { id: "Fri", label: "dayFri" },
  { id: "Sat", label: "daySat" },
  { id: "Sun", label: "daySun" },
] as const;

type TabId = "academic" | "rules" | "constraint";

function formatWindowChips(windows: TimeWindow[]): string[] {
  return windows.map((w) => `${w.start}–${w.end}`);
}

function emptyCalendar(): AcademicCalendar {
  return {
    id: `cal-${Date.now()}`,
    academicYear: "",
    semester: "Semester 1",
    semesterStart: "",
    semesterEnd: "",
    teachingWeeksStart: 1,
    teachingWeeksEnd: 14,
    breaks: [],
    isActive: false,
    notes: "",
  };
}

function emptySlotRule(): TimeSlotRule {
  const dayStart = "08:00";
  const dayEnd = "18:00";
  const stepMins = 30;
  const minDurationMins = 60;
  return {
    id: `slots-${Date.now()}`,
    label: "Time slots",
    days: ["Sat"],
    dayStart,
    dayEnd,
    stepMins,
    minDurationMins,
    slots: generateTimeSlots(dayStart, dayEnd, stepMins, minDurationMins),
  };
}

export function TimeParamsPage() {
  const { t } = useLanguage();
  const {
    calendars,
    setCalendars,
    timeRules,
    setTimeRules,
    pushAudit,
    setFlash,
  } = useStore();
  const [tab, setTab] = useState<TabId>("academic");
  const [selectedId, setSelectedId] = useState<string | null>(
    calendars.find((c) => c.isActive)?.id ?? calendars[0]?.id ?? null,
  );
  const [draftRules, setDraftRules] = useState<TimeRules>(() =>
    ensureConstraints(structuredClone(timeRules)),
  );
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [excludeStart, setExcludeStart] = useState("12:00");
  const [excludeEnd, setExcludeEnd] = useState("15:00");

  const selected =
    calendars.find((c) => c.id === selectedId) ?? calendars[0] ?? null;
  const editingRule =
    draftRules.slotRules.find((r) => r.id === editingRuleId) ?? null;

  function createCalendar() {
    const next = emptyCalendar();
    setCalendars((prev) => [next, ...prev]);
    setSelectedId(next.id);
    pushAudit("CALENDAR_CREATE", "Created new academic calendar draft");
    setFlash({ kind: "ok", message: t.calCreated });
  }

  function updateSelected(patch: Partial<AcademicCalendar>) {
    if (!selected) return;
    setCalendars((prev) =>
      prev.map((c) => {
        if (c.id !== selected.id) return c;
        const next = { ...c, ...patch };
        if ("semesterStart" in patch || "semesterEnd" in patch) {
          const span = teachingWeekSpanFromDates(
            next.semesterStart,
            next.semesterEnd,
          );
          if (span) {
            next.teachingWeeksStart = span.from;
            next.teachingWeeksEnd = span.to;
          }
        }
        return next;
      }),
    );
  }

  function setActive(id: string) {
    setCalendars((prev) =>
      prev.map((c) => ({ ...c, isActive: c.id === id })),
    );
    pushAudit("CALENDAR_ACTIVATE", `Activated calendar ${id}`);
    setFlash({ kind: "ok", message: t.calActivated });
  }

  function removeCalendar(id: string) {
    setCalendars((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (selectedId === id) {
        setSelectedId(next.find((c) => c.isActive)?.id ?? next[0]?.id ?? null);
      }
      return next;
    });
    pushAudit("CALENDAR_DELETE", `Deleted calendar ${id}`);
    setFlash({ kind: "ok", message: t.calDeleted });
  }

  function addBreak() {
    if (!selected) return;
    const brk: CalendarBreak = {
      id: `brk-${Date.now()}`,
      name: t.calBreakDefault,
      startDate: selected.semesterStart || "",
      endDate: selected.semesterEnd || "",
    };
    updateSelected({ breaks: [...selected.breaks, brk] });
  }

  function updateBreak(breakId: string, patch: Partial<CalendarBreak>) {
    if (!selected) return;
    updateSelected({
      breaks: selected.breaks.map((b) =>
        b.id === breakId ? { ...b, ...patch } : b,
      ),
    });
  }

  function removeBreak(breakId: string) {
    if (!selected) return;
    updateSelected({
      breaks: selected.breaks.filter((b) => b.id !== breakId),
    });
  }

  function saveCalendar() {
    if (!selected) return;
    if (
      !selected.academicYear.trim() ||
      !selected.semesterStart ||
      !selected.semesterEnd
    ) {
      setFlash({ kind: "bad", message: t.calIncomplete });
      return;
    }
    pushAudit(
      "CALENDAR_SAVE",
      `Saved ${selected.academicYear} ${selected.semester}`,
    );
    setFlash({ kind: "ok", message: t.calSaved });
  }

  function patchRule(id: string, patch: Partial<TimeSlotRule>) {
    setDraftRules((prev) => ({
      ...prev,
      slotRules: prev.slotRules.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      ),
    }));
  }

  function toggleRuleDay(id: string, day: string) {
    const rule = draftRules.slotRules.find((r) => r.id === id);
    if (!rule) return;
    const days = rule.days.includes(day)
      ? rule.days.filter((d) => d !== day)
      : [...rule.days, day];
    patchRule(id, { days });
  }

  function regenerateRuleSlots(id: string) {
    const rule = draftRules.slotRules.find((r) => r.id === id);
    if (!rule) return;
    const slots = generateTimeSlots(
      rule.dayStart,
      rule.dayEnd,
      rule.stepMins,
      rule.minDurationMins,
    );
    patchRule(id, { slots });
    setFlash({
      kind: "ok",
      message: t.slotsGenerated.replace("{n}", String(slots.length)),
    });
  }

  function removeOneSlot(ruleId: string, slot: string) {
    const rule = draftRules.slotRules.find((r) => r.id === ruleId);
    if (!rule) return;
    patchRule(ruleId, { slots: rule.slots.filter((s) => s !== slot) });
  }

  function excludeWindow(ruleId: string) {
    const rule = draftRules.slotRules.find((r) => r.id === ruleId);
    if (!rule) return;
    if (excludeStart >= excludeEnd) {
      setFlash({ kind: "bad", message: t.slotsExcludeInvalid });
      return;
    }
    const before = rule.slots.length;
    const slots = excludeOverlappingSlots(rule.slots, excludeStart, excludeEnd);
    const removed = before - slots.length;
    patchRule(ruleId, { slots });
    setFlash({
      kind: "ok",
      message: t.slotsExcluded
        .replace("{n}", String(removed))
        .replace("{from}", excludeStart)
        .replace("{to}", excludeEnd),
    });
  }

  function addSlotRule() {
    const next = emptySlotRule();
    next.label = t.slotsTitle;
    setDraftRules((prev) => ({
      ...prev,
      slotRules: [...prev.slotRules, next],
    }));
    setEditingRuleId(next.id);
  }

  function removeSlotRule(id: string) {
    setDraftRules((prev) => ({
      ...prev,
      slotRules: prev.slotRules.filter((r) => r.id !== id),
    }));
    if (editingRuleId === id) setEditingRuleId(null);
  }

  function saveRules(e: React.FormEvent) {
    e.preventDefault();
    if (draftRules.slotRules.some((r) => r.days.length === 0 || r.slots.length === 0)) {
      setFlash({ kind: "bad", message: t.rulesIncomplete });
      return;
    }
    const next = ensureConstraints(structuredClone(draftRules));
    setTimeRules(next);
    setDraftRules(next);
    const total = draftRules.slotRules.reduce((n, r) => n + r.slots.length, 0);
    pushAudit(
      "TIME_RULES",
      `Saved ${draftRules.slotRules.length} slot rule(s), ${total} allowed slots`,
    );
    setFlash({ kind: "ok", message: t.rulesSaved });
    setEditingRuleId(null);
  }

  function patchConstraint(id: string, patch: Partial<ScheduleConstraint>) {
    setDraftRules((prev) =>
      ensureConstraints({
        ...prev,
        constraints: (prev.constraints ?? []).map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        ),
      }),
    );
  }

  function saveConstraints(e: React.FormEvent) {
    e.preventDefault();
    const next = ensureConstraints(structuredClone(draftRules));
    setTimeRules(next);
    setDraftRules(next);
    pushAudit(
      "TIME_CONSTRAINTS",
      `Saved ${next.constraints.length} scheduling constraint profile(s)`,
    );
    setFlash({ kind: "ok", message: t.constraintSaved });
  }

  return (
    <>
      <FlashBanner />
      <div className="panel">
        <h2>{t.timeTitle}</h2>
        <p className="lead">{t.timeLede}</p>

        <div className="tabs" role="tablist" aria-label={t.timeTitle}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "academic"}
            className={tab === "academic" ? "active" : ""}
            onClick={() => setTab("academic")}
          >
            {t.tabAcademicYear}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "rules"}
            className={tab === "rules" ? "active" : ""}
            onClick={() => setTab("rules")}
          >
            {t.tabTimesRule}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "constraint"}
            className={tab === "constraint" ? "active" : ""}
            onClick={() => setTab("constraint")}
          >
            {t.tabConstraint}
          </button>
        </div>

        {tab === "academic" ? (
          <div className="tab-panel">
            <p className="lead">{t.calLede}</p>
            <div className="cal-layout">
              <aside className="cal-list">
                <button type="button" className="btn btn-sm" onClick={createCalendar}>
                  {t.calAdd}
                </button>
                <ul>
                  {calendars.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`cal-item ${selected?.id === c.id ? "active" : ""}`}
                        onClick={() => setSelectedId(c.id)}
                      >
                        <strong>{c.academicYear || t.calUntitled}</strong>
                        <span>{c.semester}</span>
                        {c.isActive && (
                          <em className="badge badge-ok">{t.calActiveBadge}</em>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>

              <div className="cal-editor">
                {!selected ? (
                  <div className="empty-note">{t.calEmpty}</div>
                ) : (
                  <>
                    <div className="field-row">
                      <div className="field">
                        <label htmlFor="year">{t.calYear}</label>
                        <input
                          id="year"
                          placeholder="2026/2027"
                          value={selected.academicYear}
                          onChange={(e) =>
                            updateSelected({ academicYear: e.target.value })
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="sem">{t.calSemester}</label>
                        <select
                          id="sem"
                          value={selected.semester}
                          onChange={(e) =>
                            updateSelected({ semester: e.target.value })
                          }
                        >
                          <option value="Semester 1">Semester 1</option>
                          <option value="Semester 2">Semester 2</option>
                          <option value="Special Semester">Special Semester</option>
                        </select>
                      </div>
                    </div>

                    <div className="field-row">
                      <div className="field">
                        <label htmlFor="sstart">{t.calSemStart}</label>
                        <input
                          id="sstart"
                          type="date"
                          value={selected.semesterStart}
                          onChange={(e) =>
                            updateSelected({ semesterStart: e.target.value })
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="send">{t.calSemEnd}</label>
                        <input
                          id="send"
                          type="date"
                          value={selected.semesterEnd}
                          onChange={(e) =>
                            updateSelected({ semesterEnd: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="field-row cal-week-row">
                      <div className="field">
                        <label htmlFor="w1">{t.calWeekFrom}</label>
                        <input
                          id="w1"
                          type="number"
                          min={1}
                          readOnly
                          value={selected.teachingWeeksStart}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="w2">{t.calWeekTo}</label>
                        <input
                          id="w2"
                          type="number"
                          min={1}
                          readOnly
                          value={selected.teachingWeeksEnd}
                        />
                      </div>
                      <div className="cal-week-count" title={t.calWeekAutoHint}>
                        <strong>
                          {Math.max(
                            0,
                            selected.teachingWeeksEnd -
                              selected.teachingWeeksStart +
                              1,
                          )}
                        </strong>
                        <span>{t.calWeekCount}</span>
                      </div>
                    </div>
                    <p className="tt-step-hint">{t.calWeekAutoHint}</p>

                    <div className="field">
                      <label htmlFor="notes">{t.calNotes}</label>
                      <textarea
                        id="notes"
                        value={selected.notes}
                        onChange={(e) =>
                          updateSelected({ notes: e.target.value })
                        }
                      />
                    </div>

                    <div className="breaks-block">
                      <div className="breaks-head">
                        <h3>{t.calBreaks}</h3>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={addBreak}
                        >
                          {t.calAddBreak}
                        </button>
                      </div>
                      {selected.breaks.length === 0 ? (
                        <p className="lead" style={{ marginBottom: 0 }}>
                          {t.calNoBreaks}
                        </p>
                      ) : (
                        selected.breaks.map((b) => (
                          <div key={b.id} className="break-row">
                            <div className="field">
                              <label>{t.calBreakName}</label>
                              <input
                                value={b.name}
                                onChange={(e) =>
                                  updateBreak(b.id, { name: e.target.value })
                                }
                              />
                            </div>
                            <div className="field">
                              <label>{t.calBreakStart}</label>
                              <input
                                type="date"
                                value={b.startDate}
                                onChange={(e) =>
                                  updateBreak(b.id, {
                                    startDate: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="field">
                              <label>{t.calBreakEnd}</label>
                              <input
                                type="date"
                                value={b.endDate}
                                onChange={(e) =>
                                  updateBreak(b.id, { endDate: e.target.value })
                                }
                              />
                            </div>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => removeBreak(b.id)}
                            >
                              {t.orgRemove}
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="chip-row" style={{ marginTop: "1rem" }}>
                      <button type="button" className="btn" onClick={saveCalendar}>
                        {t.calSave}
                      </button>
                      {!selected.isActive && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setActive(selected.id)}
                        >
                          {t.calSetActive}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => removeCalendar(selected.id)}
                      >
                        {t.calDelete}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : tab === "rules" ? (
          <div className="tab-panel">
            <p className="lead">{t.rulesLede}</p>
            <p className="lead">{t.slotsAffectNote}</p>

            <form onSubmit={saveRules}>
              <div className="chip-row" style={{ marginBottom: "0.9rem" }}>
                <button type="button" className="btn btn-sm" onClick={addSlotRule}>
                  {t.slotsAddRule}
                </button>
              </div>

              <div className="slot-rule-list">
                {draftRules.slotRules.map((rule) => (
                  <article key={rule.id} className="slot-rule-card">
                    <header className="slot-rule-head">
                      <div>
                        <h3>{rule.label || t.slotsTitle}</h3>
                        <p className="slot-days">
                          {formatSlotDayLabel(rule.days) || t.slotsNoDays}
                        </p>
                      </div>
                      <div className="chip-row">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setEditingRuleId(
                              editingRuleId === rule.id ? null : rule.id,
                            )
                          }
                          aria-label={t.slotsEdit}
                        >
                          {editingRuleId === rule.id ? t.slotsCloseEdit : t.slotsEdit}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => removeSlotRule(rule.id)}
                        >
                          {t.orgRemove}
                        </button>
                      </div>
                    </header>

                    <p className="slot-meta">
                      {t.slotsCount.replace("{n}", String(rule.slots.length))} ·{" "}
                      {rule.dayStart}–{rule.dayEnd} · {rule.stepMins}m / min{" "}
                      {rule.minDurationMins}m
                    </p>

                    <div className="slot-whitelist">
                      {rule.slots.length === 0 ? (
                        <span className="slot-empty">{t.slotsNoneLeft}</span>
                      ) : (
                        <div className="slot-chip-grid">
                          {rule.slots.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              className="slot-chip"
                              title={t.slotsRemoveOne}
                              onClick={() => removeOneSlot(rule.id, slot)}
                            >
                              <span>{slot}</span>
                              <em aria-hidden="true">×</em>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {editingRuleId === rule.id && editingRule && (
                      <div className="slot-editor">
                        <div className="field">
                          <label>{t.slotsLabel}</label>
                          <input
                            value={editingRule.label}
                            onChange={(e) =>
                              patchRule(rule.id, { label: e.target.value })
                            }
                          />
                        </div>

                        <div className="field">
                          <label>{t.timeDays}</label>
                          <div className="chip-row">
                            {DAY_KEYS.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                className={`btn btn-sm ${
                                  editingRule.days.includes(d.id) ? "" : "btn-ghost"
                                }`}
                                onClick={() => toggleRuleDay(rule.id, d.id)}
                              >
                                {t[d.label]}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="field-row">
                          <div className="field">
                            <label>{t.timeSlotStart}</label>
                            <input
                              type="time"
                              value={editingRule.dayStart}
                              onChange={(e) =>
                                patchRule(rule.id, { dayStart: e.target.value })
                              }
                            />
                          </div>
                          <div className="field">
                            <label>{t.timeSlotEnd}</label>
                            <input
                              type="time"
                              value={editingRule.dayEnd}
                              onChange={(e) =>
                                patchRule(rule.id, { dayEnd: e.target.value })
                              }
                            />
                          </div>
                        </div>

                        <div className="field-row">
                          <div className="field">
                            <label>{t.slotsStep}</label>
                            <input
                              type="number"
                              min={15}
                              step={15}
                              value={editingRule.stepMins}
                              onChange={(e) =>
                                patchRule(rule.id, {
                                  stepMins: Number(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div className="field">
                            <label>{t.slotsMinDuration}</label>
                            <input
                              type="number"
                              min={15}
                              step={15}
                              value={editingRule.minDurationMins}
                              onChange={(e) =>
                                patchRule(rule.id, {
                                  minDurationMins: Number(e.target.value),
                                })
                              }
                            />
                          </div>
                        </div>

                        <div className="exclude-block">
                          <h4>{t.slotsExcludeTitle}</h4>
                          <p className="lead" style={{ marginBottom: "0.65rem" }}>
                            {t.slotsExcludeHelp}
                          </p>
                          <div className="field-row">
                            <div className="field">
                              <label>{t.slotsExcludeFrom}</label>
                              <input
                                type="time"
                                value={excludeStart}
                                onChange={(e) => setExcludeStart(e.target.value)}
                              />
                            </div>
                            <div className="field">
                              <label>{t.slotsExcludeTo}</label>
                              <input
                                type="time"
                                value={excludeEnd}
                                onChange={(e) => setExcludeEnd(e.target.value)}
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => excludeWindow(rule.id)}
                          >
                            {t.slotsExcludeApply}
                          </button>
                        </div>

                        <div className="chip-row" style={{ marginTop: "0.75rem" }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => regenerateRuleSlots(rule.id)}
                          >
                            {t.slotsRegenerate}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>

              <div className="breaks-block" style={{ marginTop: "1.2rem" }}>
                <h3 style={{ marginBottom: "0.75rem" }}>{t.slotsClashTitle}</h3>
                <div className="toggle-row">
                  <div>
                    <strong>{t.timeClashRoom}</strong>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={draftRules.clashRoom}
                      onChange={(e) =>
                        setDraftRules({
                          ...draftRules,
                          clashRoom: e.target.checked,
                        })
                      }
                    />
                    <span />
                  </label>
                </div>
                <div className="toggle-row">
                  <div>
                    <strong>{t.timeClashLecturer}</strong>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={draftRules.clashLecturer}
                      onChange={(e) =>
                        setDraftRules({
                          ...draftRules,
                          clashLecturer: e.target.checked,
                        })
                      }
                    />
                    <span />
                  </label>
                </div>
                <div className="toggle-row">
                  <div>
                    <strong>{t.timeClashOcc}</strong>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={draftRules.clashOccurrence}
                      onChange={(e) =>
                        setDraftRules({
                          ...draftRules,
                          clashOccurrence: e.target.checked,
                        })
                      }
                    />
                    <span />
                  </label>
                </div>
              </div>

              <button type="submit" className="btn" style={{ marginTop: "1rem" }}>
                {t.rulesSave}
              </button>
            </form>
          </div>
        ) : (
          <div className="tab-panel">
            <p className="lead">{t.constraintLede}</p>
            <p className="lead">{t.constraintAffectNote}</p>

            <form onSubmit={saveConstraints}>
              <div className="slot-rule-list">
                {(draftRules.constraints ?? []).map((c) => (
                  <article key={c.id} className="slot-rule-card constraint-card">
                    <header className="slot-rule-head">
                      <div>
                        <h3>
                          {c.code}
                          <span className="constraint-label"> — {c.label}</span>
                        </h3>
                        <p className="slot-days">{c.summary}</p>
                      </div>
                      <label className="switch" title={t.constraintEnabled}>
                        <input
                          type="checkbox"
                          checked={c.enabled}
                          onChange={(e) =>
                            patchConstraint(c.id, { enabled: e.target.checked })
                          }
                          aria-label={t.constraintEnabled}
                        />
                        <span />
                      </label>
                    </header>

                    <div className="constraint-windows">
                      <div>
                        <strong>{t.constraintWeekday}</strong>
                        <div className="slot-chip-grid" style={{ marginTop: "0.4rem" }}>
                          {formatWindowChips(c.weekdayWindows).map((w) => (
                            <span key={`wd-${c.id}-${w}`} className="slot-chip constraint-chip">
                              <span>{w}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginTop: "0.75rem" }}>
                        <strong>{t.constraintFriday}</strong>
                        {c.fridayWindows.length === 0 ? (
                          <p className="slot-meta" style={{ marginBottom: 0 }}>
                            {t.constraintFridaySame}
                          </p>
                        ) : (
                          <div className="slot-chip-grid" style={{ marginTop: "0.4rem" }}>
                            {formatWindowChips(c.fridayWindows).map((w) => (
                              <span key={`fri-${c.id}-${w}`} className="slot-chip constraint-chip">
                                <span>{w}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <button type="submit" className="btn" style={{ marginTop: "1rem" }}>
                {t.constraintSave}
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
