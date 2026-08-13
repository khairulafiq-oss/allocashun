import { useEffect, useMemo, useState } from "react";
import { AutoPatternDialog } from "../../components/AutoPatternDialog";
import { AutoSlotEditDialog } from "../../components/AutoSlotEditDialog";
import { FlashBanner } from "../../components/FlashBanner";
import { WeekTimetableGrid } from "../../components/WeekTimetableGrid";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  defaultAutoParams,
  defaultPattern,
  runAutoGenerate,
  type AutoGenerateResult,
} from "../../lib/autoGenerate";
import { flattenOfferedTargets, parseDietPackageFile } from "../../lib/dietPackageImport";
import { getSchedulableDays } from "../../lib/schedulingRules";
import { constraintPickerLabel } from "../../lib/scheduleConstraints";
import { timeToMinutes } from "../../lib/timeSlots";
import { useStore } from "../../state/StoreContext";
import type {
  AutoGenerateParams,
  AutoSchedulePattern,
  DietPackagePreview,
  ScheduleEntry,
} from "../../types";

type PatternEditor = {
  mode: "create" | "edit";
  draft: AutoSchedulePattern;
};

export function MechaAutoPage() {
  const { t } = useLanguage();
  const {
    calendars,
    faculties,
    activities,
    offeringGroups,
    rooms,
    schedule,
    setSchedule,
    timeRules,
    setFlash,
    pushAudit,
    archiveScheduleEntries,
  } = useStore();

  const [params, setParams] = useState<AutoGenerateParams>(() =>
    defaultAutoParams(),
  );
  const [pkg, setPkg] = useState<DietPackagePreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<AutoGenerateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<PatternEditor | null>(null);
  const [applied, setApplied] = useState(false);
  const [resultView, setResultView] = useState<"calendar" | "list">("calendar");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [slotEditor, setSlotEditor] = useState<ScheduleEntry | null>(null);

  const calendarOptions = useMemo(() => {
    return [...calendars].sort((a, b) =>
      `${a.academicYear} ${a.semester}`.localeCompare(
        `${b.academicYear} ${b.semester}`,
      ),
    );
  }, [calendars]);

  const facultyOptions = useMemo(
    () =>
      [...faculties].sort((a, b) =>
        a.facultyCode.localeCompare(b.facultyCode, undefined, {
          numeric: true,
        }),
      ),
    [faculties],
  );

  const activeActivities = useMemo(
    () => activities.filter((a) => a.inUse),
    [activities],
  );

  const durationOptions = useMemo(() => {
    const set = new Set<number>();
    for (const rule of timeRules.slotRules) {
      for (const slot of rule.slots) {
        const [start, end] = slot.split("-");
        if (!start || !end) continue;
        const mins = timeToMinutes(end) - timeToMinutes(start);
        if (mins > 0) set.add(mins);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [timeRules]);

  const whitelistByDuration = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const rule of timeRules.slotRules) {
      for (const slot of rule.slots) {
        const [start, end] = slot.split("-");
        if (!start || !end) continue;
        const mins = timeToMinutes(end) - timeToMinutes(start);
        if (mins <= 0) continue;
        const list = map.get(mins) ?? [];
        if (!list.includes(slot)) list.push(slot);
        map.set(mins, list);
      }
    }
    for (const [k, list] of map) map.set(k, list.sort());
    return map;
  }, [timeRules]);

  const packageModules = useMemo(() => {
    if (!pkg) return [];
    return flattenOfferedTargets(pkg, params.facultyCode || undefined);
  }, [pkg, params.facultyCode]);

  /** Modules already on the board for this calendar + faculty — one submit only. */
  const scheduledModuleCodes = useMemo(() => {
    const set = new Set<string>();
    const year = params.academicYear.trim();
    const period = params.periodSlot.trim();
    const fac = params.facultyCode.trim().toUpperCase();
    if (!year || !period) return set;
    for (const entry of schedule) {
      if (entry.academicYear !== year) continue;
      if (entry.periodSlot !== period) continue;
      if (fac && entry.facultyCode.trim().toUpperCase() !== fac) continue;
      const code = entry.moduleCode.trim().toUpperCase();
      if (code) set.add(code);
    }
    return set;
  }, [schedule, params.academicYear, params.periodSlot, params.facultyCode]);

  const moduleGroups = useMemo(() => {
    const map = new Map<
      string,
      { moduleCode: string; occurrences: { code: string; capacity: number }[] }
    >();
    for (const row of packageModules) {
      const key = row.moduleCode.toUpperCase();
      let group = map.get(key);
      if (!group) {
        group = { moduleCode: row.moduleCode, occurrences: [] };
        map.set(key, group);
      }
      if (
        !group.occurrences.some(
          (o) => o.code.toUpperCase() === row.occurrence.toUpperCase(),
        )
      ) {
        group.occurrences.push({
          code: row.occurrence,
          capacity: row.capacity,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.moduleCode.localeCompare(b.moduleCode, undefined, { numeric: true }),
    );
  }, [packageModules]);

  const patternsByModule = useMemo(() => {
    const map = new Map<string, typeof params.patterns>();
    for (const p of params.patterns) {
      const key = p.moduleCode.trim().toUpperCase() || "_";
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return map;
  }, [params.patterns]);

  const enabledConstraints = useMemo(
    () => (timeRules.constraints ?? []).filter((c) => c.enabled),
    [timeRules.constraints],
  );

  useEffect(() => {
    if (enabledConstraints.length === 0) return;
    if (enabledConstraints.some((c) => c.id === params.constraintId)) return;
    const ug = enabledConstraints.find(
      (c) => c.code.trim().toUpperCase() === "UG",
    );
    setParams((prev) => ({
      ...prev,
      constraintId: ug?.id ?? enabledConstraints[0].id,
    }));
  }, [enabledConstraints, params.constraintId]);

  function patch(partial: Partial<AutoGenerateParams>) {
    setParams((prev) => ({ ...prev, ...partial }));
    setResult(null);
  }

  function preferredActivityCode(): string {
    const lec = activeActivities.find(
      (a) => a.activityCode.trim().toUpperCase() === "LEC",
    );
    return lec?.activityCode || activeActivities[0]?.activityCode || "LEC";
  }

  function addPatternForModule(moduleCode: string) {
    if (scheduledModuleCodes.has(moduleCode.trim().toUpperCase())) {
      setFlash({
        kind: "bad",
        message: t.autoModuleLocked.replace("{code}", moduleCode),
      });
      return;
    }
    const activityCode = preferredActivityCode();
    setEditor({
      mode: "create",
      draft: defaultPattern({
        label: `${moduleCode} · ${activityCode}`,
        moduleCode,
        occurrenceCodes: [],
        activityCode,
        sessionsCount: 1,
        durationMins: durationOptions[0] || 60,
      }),
    });
  }

  function editPattern(pattern: AutoSchedulePattern) {
    setEditor({ mode: "edit", draft: { ...pattern } });
  }

  function copyPattern(pattern: AutoSchedulePattern) {
    if (scheduledModuleCodes.has(pattern.moduleCode.trim().toUpperCase())) {
      setFlash({
        kind: "bad",
        message: t.autoModuleLocked.replace("{code}", pattern.moduleCode),
      });
      return;
    }
    setEditor({
      mode: "create",
      draft: defaultPattern({
        ...pattern,
        id: undefined,
        label: `${pattern.label || pattern.activityCode} copy`,
      }),
    });
  }

  function saveEditor() {
    if (!editor) return;
    if (editor.mode === "create") {
      patch({ patterns: [...params.patterns, editor.draft] });
    } else {
      patch({
        patterns: params.patterns.map((p) =>
          p.id === editor.draft.id ? editor.draft : p,
        ),
      });
    }
    setEditor(null);
  }

  function removePattern(id: string) {
    patch({ patterns: params.patterns.filter((p) => p.id !== id) });
    if (editor?.draft.id === id) setEditor(null);
  }

  function onCalendarChange(calendarId: string) {
    const cal = calendars.find((c) => c.id === calendarId);
    if (!cal) {
      patch({ academicYear: "", periodSlot: "" });
      return;
    }
    patch({
      academicYear: cal.academicYear,
      periodSlot: cal.semester,
    });
  }

  async function onPackageFile(file: File | null) {
    if (!file) return;
    setParsing(true);
    setResult(null);
    setApplied(false);
    setSelectedIds(new Set());
    setSlotEditor(null);
    // Let React paint the busy state before heavy sync parse.
    await new Promise<void>((r) => setTimeout(r, 0));
    try {
      const buffer = await file.arrayBuffer();
      const preview = parseDietPackageFile(buffer, file.name);
      setPkg(preview);
      if (preview.dietCount === 0) {
        setFlash({ kind: "bad", message: t.autoPkgEmpty });
      } else {
        setFlash({
          kind: "ok",
          message: t.autoPkgLoaded
            .replace("{diets}", String(preview.dietCount))
            .replace("{mods}", String(preview.offeredCount)),
        });
        const facultiesInFile = [
          ...new Set(
            preview.diets.map((d) => d.facultyCode.trim()).filter(Boolean),
          ),
        ];
        if (facultiesInFile.length === 1 && !params.facultyCode) {
          patch({ facultyCode: facultiesInFile[0] });
        }
      }
    } catch {
      setPkg(null);
      setFlash({ kind: "bad", message: t.autoPkgError });
    } finally {
      setParsing(false);
    }
  }

  function canRun(): boolean {
    return (
      !!pkg &&
      pkg.dietCount > 0 &&
      !!params.facultyCode &&
      !!params.constraintId.trim() &&
      params.patterns.some((p) => p.moduleCode.trim())
    );
  }

  async function previewPlan() {
    if (!pkg || !canRun()) return;
    setBusy(true);
    await new Promise<void>((r) => setTimeout(r, 0));
    try {
      const next = runAutoGenerate({
        packagePreview: pkg,
        params,
        offerings: offeringGroups,
        rooms,
        activities,
        existing: schedule,
        timeRules,
        apply: false,
        lockedModuleCodes: Array.from(scheduledModuleCodes),
      });
      setResult(next);
      setApplied(false);
      setSelectedIds(new Set());
      setFlash({
        kind: "ok",
        message: t.autoPreviewDone
          .replace("{ready}", String(next.readyCount))
          .replace("{skip}", String(next.skipCount))
          .replace("{err}", String(next.errorCount)),
      });
    } finally {
      setBusy(false);
    }
  }

  async function applyGenerate() {
    if (!pkg || !canRun()) return;
    setBusy(true);
    await new Promise<void>((r) => setTimeout(r, 0));
    try {
      const next = runAutoGenerate({
        packagePreview: pkg,
        params,
        offerings: offeringGroups,
        rooms,
        activities,
        existing: schedule,
        timeRules,
        apply: true,
        lockedModuleCodes: Array.from(scheduledModuleCodes),
      });
      setResult(next);
      setApplied(next.created.length > 0);
      setSelectedIds(new Set());
      if (next.created.length > 0) {
        setSchedule((prev) => [...prev, ...next.created]);
        pushAudit(
          "auto_generate",
          `Created ${next.created.length} draft slots from ${pkg.fileName} (${params.patterns.length} patterns)`,
        );
      }
      setFlash({
        kind: next.created.length > 0 ? "ok" : "bad",
        message: t.autoApplyDone
          .replace("{n}", String(next.created.length))
          .replace("{err}", String(next.errorCount)),
      });
    } finally {
      setBusy(false);
    }
  }

  const selectedCalendarId =
    calendarOptions.find(
      (c) =>
        c.academicYear === params.academicYear &&
        c.semester === params.periodSlot,
    )?.id ?? "";

  const gridDays = useMemo(() => {
    const days = getSchedulableDays(timeRules);
    return days.length > 0 ? days : ["Mon", "Tue", "Wed", "Thu", "Fri"];
  }, [timeRules]);

  const whitelistSlots = useMemo(() => {
    const set = new Set<string>();
    for (const rule of timeRules.slotRules) {
      for (const slot of rule.slots) set.add(slot);
    }
    return Array.from(set).sort();
  }, [timeRules]);

  const previewEntries = useMemo(() => {
    if (!result) return [] as ScheduleEntry[];
    return result.plan
      .map((row) => row.draft)
      .filter((row): row is ScheduleEntry => !!row);
  }, [result]);

  const previewIds = useMemo(
    () => new Set(previewEntries.map((e) => e.id)),
    [previewEntries],
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === previewEntries.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(previewEntries.map((e) => e.id)));
  }

  function unscheduleSelected() {
    if (selectedIds.size === 0) return;
    const ids = selectedIds;
    const toArchive = previewEntries.filter((e) => ids.has(e.id));
    if (applied && toArchive.length > 0) {
      archiveScheduleEntries(toArchive, "bulk_remove");
    }
    setResult((prev) => {
      if (!prev) return prev;
      const plan = prev.plan.filter(
        (row) => !row.draft || !ids.has(row.draft.id),
      );
      const created = prev.created.filter((e) => !ids.has(e.id));
      return {
        ...prev,
        plan,
        created,
        readyCount: plan.filter((p) => p.status === "ready").length,
        skipCount: plan.filter(
          (p) =>
            p.status === "skip_existing" || p.status === "already_scheduled",
        ).length,
        errorCount: plan.filter(
          (p) =>
            p.status === "no_slot" ||
            p.status === "no_room" ||
            p.status === "no_pattern",
        ).length,
      };
    });
    setSelectedIds(new Set());
    setSlotEditor(null);
    setFlash({
      kind: "ok",
      message: t.autoUnscheduled.replace("{n}", String(toArchive.length)),
    });
    if (applied && toArchive.length > 0) {
      pushAudit("auto_unschedule", `Unscheduled ${toArchive.length} auto slot(s)`);
    }
  }

  function openSlotEdit(entry: ScheduleEntry) {
    setSlotEditor({ ...entry });
  }

  function saveSlotEdit() {
    if (!slotEditor) return;
    const next = slotEditor;
    setResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        plan: prev.plan.map((row) =>
          row.draft?.id === next.id ? { ...row, draft: next } : row,
        ),
        created: prev.created.map((e) => (e.id === next.id ? next : e)),
      };
    });
    if (applied) {
      setSchedule((prev) => prev.map((e) => (e.id === next.id ? next : e)));
    }
    setSlotEditor(null);
  }

  return (
    <>
      <FlashBanner />
      <div className="panel">
        <h2>{t.mechaAutoTitle}</h2>
        <p className="lead">{t.mechaAutoLede}</p>

        <ol className="auto-steps">
          <li>
            <strong>{t.autoStepScope}</strong> — {t.autoStepScopeHint}
          </li>
          <li>
            <strong>{t.autoStepPackage}</strong> — {t.autoStepPackageHint}
          </li>
          <li>
            <strong>{t.autoStepParams}</strong> — {t.autoStepParamsHint}
          </li>
          <li>
            <strong>{t.autoStepRun}</strong> — {t.autoStepRunHint}
          </li>
        </ol>
      </div>

      <div className="panel">
        <h3>{t.autoStepScope}</h3>
        <div className="field-row">
          <label className="field">
            <span>{t.ttCalendar}</span>
            <select
              value={selectedCalendarId}
              onChange={(e) => onCalendarChange(e.target.value)}
            >
              <option value="">{t.autoPickCalendar}</option>
              {calendarOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.academicYear} · {c.semester}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t.ttFaculty}</span>
            <select
              value={params.facultyCode}
              onChange={(e) => patch({ facultyCode: e.target.value })}
            >
              <option value="">{t.autoPickFaculty}</option>
              {facultyOptions.map((f) => (
                <option key={f.id} value={f.facultyCode}>
                  {f.facultyCode}
                  {f.shortName ? ` — ${f.shortName}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t.autoConstraint}</span>
            <select
              value={params.constraintId}
              required
              onChange={(e) => patch({ constraintId: e.target.value })}
            >
              {enabledConstraints.length === 0 ? (
                <option value="">{t.autoPickConstraint}</option>
              ) : null}
              {enabledConstraints.map((c) => (
                <option key={c.id} value={c.id} title={c.summary}>
                  {constraintPickerLabel(c)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="panel">
        <h3>{t.autoStepPackage}</h3>
        <p className="lead">{t.autoPkgLede}</p>
        <p className="auto-param-hint">{t.autoPkgTemplateHint}</p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const a = document.createElement("a");
              a.href = "/templates/diet-package-template.csv";
              a.download = "diet-package-template.csv";
              a.click();
            }}
          >
            {t.autoPkgTemplate}
          </button>
        </div>
        <label className="field">
          <span>{t.autoPkgFile}</span>
          <input
            type="file"
            accept=".csv,.txt,.xlsx,.xls"
            disabled={parsing}
            onChange={(e) => onPackageFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {pkg ? (
          <>
            <div className="auto-pkg-stats">
              <div>
                <strong>{pkg.dietCount}</strong>
                <span>{t.autoStatDiets}</span>
              </div>
              <div>
                <strong>{pkg.moduleReqCount}</strong>
                <span>{t.autoStatModules}</span>
              </div>
              <div>
                <strong>{pkg.offeredCount}</strong>
                <span>{t.autoStatOffered}</span>
              </div>
              <div>
                <strong>{packageModules.length}</strong>
                <span>{t.autoStatTargets}</span>
              </div>
            </div>
            {params.facultyCode ? (
              <div className="auto-module-list">
                <h4>{t.autoModuleListTitle}</h4>
                <p className="auto-param-hint">{t.autoModuleListHint}</p>
                <p className="auto-param-hint">{t.autoModuleLockHint}</p>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t.ttModule}</th>
                        <th>{t.ttOffering}</th>
                        <th>{t.autoPatternCol}</th>
                        <th>{t.ttStatus}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {moduleGroups.slice(0, 60).map((group) => {
                        const count =
                          patternsByModule.get(group.moduleCode.toUpperCase())
                            ?.length ?? 0;
                        const locked = scheduledModuleCodes.has(
                          group.moduleCode.toUpperCase(),
                        );
                        return (
                          <tr
                            key={group.moduleCode}
                            className={locked ? "auto-module-locked" : undefined}
                          >
                            <td>{group.moduleCode}</td>
                            <td>
                              {group.occurrences.map((o) => o.code).join(", ")}
                            </td>
                            <td>{count}</td>
                            <td>
                              {locked ? (
                                <span className="badge">{t.autoStatusScheduled}</span>
                              ) : (
                                <span className="badge badge-ok">
                                  {t.autoStatusOpen}
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={locked}
                                onClick={() =>
                                  addPatternForModule(group.moduleCode)
                                }
                              >
                                {t.autoAddPattern}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {moduleGroups.length > 60 ? (
                  <p className="empty-note">
                    {t.autoModuleListTruncated.replace(
                      "{n}",
                      String(moduleGroups.length),
                    )}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="empty-note">{t.autoPickFacultyFirst}</p>
            )}
          </>
        ) : (
          <p className="empty-note">{t.autoPkgWaiting}</p>
        )}
      </div>

      <div className="panel">
        <h3>{t.autoStepParams}</h3>
        <p className="lead">{t.autoPatternsLede}</p>

        {params.patterns.length === 0 ? (
          <p className="empty-note">{t.autoPatternsEmpty}</p>
        ) : null}

        <div className="auto-pattern-list">
          {params.patterns.map((pattern) => {
            const locked = scheduledModuleCodes.has(
              pattern.moduleCode.trim().toUpperCase(),
            );
            return (
              <div key={pattern.id} className="auto-pattern-card">
                <div className="auto-pattern-summary">
                  <button
                    type="button"
                    className="auto-pattern-toggle"
                    onClick={() => editPattern(pattern)}
                  >
                    <strong>
                      {pattern.moduleCode || "?"} ·{" "}
                      {pattern.label || pattern.activityCode}
                    </strong>
                    <span>
                      {pattern.sessionsCount}× {pattern.activityCode} ·{" "}
                      {pattern.durationMins} min ·{" "}
                      {pattern.occurrenceCodes.length === 0
                        ? t.autoOccAll
                        : `occ ${pattern.occurrenceCodes.join(", ")}`}
                      {locked ? ` · ${t.autoStatusScheduled}` : ""}
                    </span>
                  </button>
                  <div className="btn-row" style={{ margin: 0 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => editPattern(pattern)}
                    >
                      {t.autoEditPattern}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={locked}
                      onClick={() => copyPattern(pattern)}
                    >
                      {t.autoCopyPattern}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => removePattern(pattern.id)}
                    >
                      {t.autoRemovePattern}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="auto-param-block">
          <div className="auto-param-head">
            <span>{t.autoSlotSpread}</span>
          </div>
          <p className="auto-param-hint">{t.autoSlotSpreadHint}</p>
          <div className="auto-mode-toggle" role="group">
            <button
              type="button"
              className={params.slotSpread === "padding" ? "is-active" : ""}
              onClick={() => patch({ slotSpread: "padding" })}
            >
              {t.autoSpreadPadding}
            </button>
            <button
              type="button"
              className={params.slotSpread === "random" ? "is-active" : ""}
              onClick={() => patch({ slotSpread: "random" })}
            >
              {t.autoSpreadRandom}
            </button>
          </div>
        </div>

        <div className="field-row" style={{ marginTop: "0.85rem" }}>
          <label className="auto-check">
            <input
              type="checkbox"
              checked={params.respectCapacity}
              onChange={(e) => patch({ respectCapacity: e.target.checked })}
            />
            {t.autoRespectCapacity}
          </label>
          <label className="auto-check">
            <input
              type="checkbox"
              checked={params.allowClashes}
              onChange={(e) => patch({ allowClashes: e.target.checked })}
            />
            {t.autoAllowClashes}
          </label>
        </div>
      </div>

      <div className="panel">
        <h3>{t.autoStepRun}</h3>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!canRun() || busy}
            onClick={previewPlan}
          >
            {t.autoPreview}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!canRun() || busy}
            onClick={applyGenerate}
          >
            {t.autoGenerate}
          </button>
        </div>
        {!canRun() ? (
          <p className="empty-note">{t.autoNeedInputs}</p>
        ) : null}

        {result ? (
          <div className="auto-result">
            <p className="lead">
              {t.autoResultSummary
                .replace("{ready}", String(result.readyCount))
                .replace("{skip}", String(result.skipCount))
                .replace("{err}", String(result.errorCount))}
            </p>

            <div className="auto-result-toolbar">
              <div className="auto-mode-toggle" role="group">
                <button
                  type="button"
                  className={resultView === "calendar" ? "is-active" : ""}
                  onClick={() => setResultView("calendar")}
                >
                  {t.autoViewCalendar}
                </button>
                <button
                  type="button"
                  className={resultView === "list" ? "is-active" : ""}
                  onClick={() => setResultView("list")}
                >
                  {t.autoViewList}
                </button>
              </div>
              <div className="btn-row" style={{ margin: 0 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSelectMode((on) => !on);
                    setSelectedIds(new Set());
                  }}
                >
                  {selectMode ? t.autoSelectDone : t.autoSelectSlots}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={previewEntries.length === 0}
                  onClick={toggleSelectAll}
                >
                  {selectedIds.size === previewEntries.length &&
                  previewEntries.length > 0
                    ? t.autoClearSelection
                    : t.autoSelectAll}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={selectedIds.size === 0}
                  onClick={unscheduleSelected}
                >
                  {t.autoUnschedule}
                </button>
              </div>
            </div>
            <p className="auto-param-hint">
              {selectMode ? t.autoSelectHint : t.autoEditHint}
            </p>

            {resultView === "calendar" ? (
              <WeekTimetableGrid
                entries={previewEntries}
                days={gridDays}
                emptyLabel={t.autoPreviewEmpty}
                selectMode={selectMode}
                selectedIds={selectedIds}
                selectableIds={previewIds}
                onToggleSelect={toggleSelect}
                onBlockClick={(sources) => {
                  if (selectMode) {
                    for (const src of sources) toggleSelect(src.id);
                    return;
                  }
                  if (sources[0]) openSlotEdit(sources[0]);
                }}
              />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={
                            previewEntries.length > 0 &&
                            selectedIds.size === previewEntries.length
                          }
                          onChange={toggleSelectAll}
                          aria-label={t.autoSelectAll}
                        />
                      </th>
                      <th>{t.ttModule}</th>
                      <th>{t.ttOffering}</th>
                      <th>{t.autoPatternCol}</th>
                      <th>{t.ttActivity}</th>
                      <th>{t.ttDay}</th>
                      <th>{t.ttSlot}</th>
                      <th>{t.ttRoom}</th>
                      <th>{t.ttStatus}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {result.plan.slice(0, 120).map((row) => {
                      const id = row.draft?.id;
                      return (
                        <tr
                          key={`${row.moduleCode}-${row.occurrence}-${row.patternId}-${row.sessionIndex}-${row.status}`}
                        >
                          <td>
                            {id ? (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(id)}
                                onChange={() => toggleSelect(id)}
                              />
                            ) : null}
                          </td>
                          <td>{row.moduleCode}</td>
                          <td>{row.occurrence}</td>
                          <td>
                            {row.patternLabel}
                            {row.sessionIndex > 1
                              ? ` #${row.sessionIndex}`
                              : ""}
                          </td>
                          <td>{row.draft?.activityCode ?? "—"}</td>
                          <td>{row.draft?.day ?? "—"}</td>
                          <td>
                            {row.draft
                              ? `${row.draft.startTime}-${row.draft.endTime}`
                              : "—"}
                          </td>
                          <td>{row.draft?.roomCode ?? "—"}</td>
                          <td>
                            <span
                              className={
                                row.status === "ready"
                                  ? "badge badge-ok"
                                  : row.status === "skip_existing" ||
                                      row.status === "already_scheduled"
                                    ? "badge"
                                    : "badge badge-bad"
                              }
                            >
                              {row.status === "ready"
                                ? t.autoStatusReady
                                : row.status === "skip_existing"
                                  ? t.autoStatusSkip
                                  : row.status === "already_scheduled"
                                    ? t.autoStatusAlready
                                    : row.status === "no_room"
                                      ? t.autoStatusNoRoom
                                      : t.autoStatusNoSlot}
                            </span>
                            {row.reason ? (
                              <span className="auto-reason"> {row.reason}</span>
                            ) : null}
                          </td>
                          <td>
                            {row.draft ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => openSlotEdit(row.draft!)}
                              >
                                {t.autoEditSlot}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {result.plan.length > 120 ? (
              <p className="empty-note">
                {t.autoResultTruncated.replace(
                  "{n}",
                  String(result.plan.length),
                )}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <AutoPatternDialog
        open={editor !== null}
        mode={editor?.mode ?? "create"}
        draft={editor?.draft ?? null}
        occurrences={
          moduleGroups.find(
            (g) =>
              g.moduleCode.toUpperCase() ===
              (editor?.draft.moduleCode ?? "").toUpperCase(),
          )?.occurrences ?? []
        }
        activities={activeActivities}
        rooms={rooms}
        durationOptions={durationOptions}
        slotsForDuration={
          editor
            ? (whitelistByDuration.get(editor.draft.durationMins) ?? [])
            : []
        }
        labels={{
          titleNew: t.autoPatternDialogNew,
          titleEdit: t.autoPatternDialogEdit,
          save: t.autoSavePattern,
          cancel: t.sysCancel,
          module: t.ttModule,
          patternLabel: t.autoPatternLabel,
          activity: t.ttActivity,
          sessions: t.autoSessionsCount,
          duration: t.autoDurationMins,
          weeks: t.ttWeeks,
          day: t.ttDay,
          timeSlot: t.autoTimeSlot,
          slot: t.ttSlot,
          lecturer: t.ttLecturer,
          room: t.ttRoom,
          pickRoom: t.autoPickRoom,
          modeAuto: t.autoModeAuto,
          modeManual: t.autoModeManual,
          occSelect: t.autoOccSelect,
          occSelectHint: t.autoOccSelectHint,
          occAllActive: t.autoOccAllActive,
          weeksHint: t.autoWeeksHint,
          dayHint: t.autoDayHint,
          timeHint: t.autoTimeHint,
          lecturerHint: t.autoLecturerHint,
          lecturerPh: t.autoLecturerPh,
          roomHint: t.autoRoomHint,
          consecutive: t.autoConsecutive,
        }}
        onChange={(partial) =>
          setEditor((prev) =>
            prev ? { ...prev, draft: { ...prev.draft, ...partial } } : prev,
          )
        }
        onSave={saveEditor}
        onCancel={() => setEditor(null)}
      />

      <AutoSlotEditDialog
        open={slotEditor !== null}
        entry={slotEditor}
        days={gridDays}
        slots={whitelistSlots}
        rooms={rooms}
        activities={activeActivities}
        labels={{
          title: t.autoEditSlotTitle,
          save: t.autoSaveSlot,
          cancel: t.sysCancel,
          day: t.ttDay,
          slot: t.ttSlot,
          room: t.ttRoom,
          pickRoom: t.autoPickRoom,
          lecturer: t.ttLecturer,
          activity: t.ttActivity,
          weeks: t.ttWeeks,
        }}
        onChange={(partial) =>
          setSlotEditor((prev) => (prev ? { ...prev, ...partial } : prev))
        }
        onSave={saveSlotEdit}
        onCancel={() => setSlotEditor(null)}
      />
    </>
  );
}
