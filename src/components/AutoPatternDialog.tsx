import { createPortal } from "react-dom";
import type {
  Activity,
  AutoParamMode,
  AutoSchedulePattern,
  Room,
} from "../types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type OccurrenceOpt = { code: string; capacity: number };

type Labels = {
  titleNew: string;
  titleEdit: string;
  save: string;
  cancel: string;
  module: string;
  patternLabel: string;
  activity: string;
  sessions: string;
  duration: string;
  weeks: string;
  day: string;
  timeSlot: string;
  slot: string;
  lecturer: string;
  room: string;
  pickRoom: string;
  modeAuto: string;
  modeManual: string;
  occSelect: string;
  occSelectHint: string;
  occAllActive: string;
  weeksHint: string;
  dayHint: string;
  timeHint: string;
  lecturerHint: string;
  lecturerPh: string;
  roomHint: string;
  consecutive: string;
};

function ModeToggle({
  value,
  onChange,
  autoLabel,
  manualLabel,
}: {
  value: AutoParamMode;
  onChange: (mode: AutoParamMode) => void;
  autoLabel: string;
  manualLabel: string;
}) {
  return (
    <div className="auto-mode-toggle" role="group">
      <button
        type="button"
        className={value === "auto" ? "is-active" : ""}
        onClick={() => onChange("auto")}
      >
        {autoLabel}
      </button>
      <button
        type="button"
        className={value === "manual" ? "is-active" : ""}
        onClick={() => onChange("manual")}
      >
        {manualLabel}
      </button>
    </div>
  );
}

type Props = {
  open: boolean;
  mode: "create" | "edit";
  draft: AutoSchedulePattern | null;
  occurrences: OccurrenceOpt[];
  activities: Activity[];
  rooms: Room[];
  durationOptions: number[];
  slotsForDuration: string[];
  labels: Labels;
  onChange: (partial: Partial<AutoSchedulePattern>) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function AutoPatternDialog({
  open,
  mode,
  draft,
  occurrences,
  activities,
  rooms,
  durationOptions,
  slotsForDuration,
  labels,
  onChange,
  onSave,
  onCancel,
}: Props) {
  if (!open || !draft) return null;

  return createPortal(
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal modal-wide auto-pattern-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-pattern-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tt-detail-head">
          <div>
            <h3 id="auto-pattern-title">
              {mode === "create" ? labels.titleNew : labels.titleEdit}
            </h3>
            <p className="tt-detail-hero-sub">{draft.moduleCode}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
          >
            {labels.cancel}
          </button>
        </div>

        <div className="field-row">
          <label className="field">
            <span>{labels.module}</span>
            <input value={draft.moduleCode} readOnly />
          </label>
          <label className="field">
            <span>{labels.patternLabel}</span>
            <input
              value={draft.label}
              onChange={(e) => onChange({ label: e.target.value })}
            />
          </label>
        </div>

        <div className="auto-param-block">
          <div className="auto-param-head">
            <span>{labels.occSelect}</span>
          </div>
          <p className="auto-param-hint">{labels.occSelectHint}</p>
          <div className="auto-day-picks">
            {occurrences.map((occ) => {
              const allSelected = draft.occurrenceCodes.length === 0;
              const on =
                allSelected ||
                draft.occurrenceCodes.some(
                  (c) => c.toUpperCase() === occ.code.toUpperCase(),
                );
              return (
                <label key={occ.code} className="auto-check">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      let next: string[];
                      if (allSelected) {
                        next = occurrences
                          .map((o) => o.code)
                          .filter(
                            (c) =>
                              c.toUpperCase() !== occ.code.toUpperCase(),
                          );
                      } else if (on) {
                        next = draft.occurrenceCodes.filter(
                          (c) => c.toUpperCase() !== occ.code.toUpperCase(),
                        );
                      } else {
                        next = [...draft.occurrenceCodes, occ.code];
                      }
                      if (
                        next.length === 0 ||
                        next.length === occurrences.length
                      ) {
                        next = [];
                      }
                      onChange({ occurrenceCodes: next });
                    }}
                  />
                  {occ.code}
                  {occ.capacity ? ` (${occ.capacity})` : ""}
                </label>
              );
            })}
          </div>
          {draft.occurrenceCodes.length === 0 ? (
            <p className="auto-param-hint">{labels.occAllActive}</p>
          ) : null}
        </div>

        <div className="field-row">
          <label className="field">
            <span>{labels.activity}</span>
            <select
              value={
                activities.some(
                  (a) => a.activityCode === draft.activityCode,
                )
                  ? draft.activityCode
                  : (activities[0]?.activityCode ?? draft.activityCode)
              }
              onChange={(e) => onChange({ activityCode: e.target.value })}
            >
              {activities.map((a) => (
                <option key={a.id} value={a.activityCode}>
                  {a.activityCode} — {a.activityName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{labels.sessions}</span>
            <input
              type="number"
              min={1}
              max={20}
              value={draft.sessionsCount}
              onChange={(e) =>
                onChange({
                  sessionsCount: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>{labels.duration}</span>
            <select
              value={draft.durationMins}
              onChange={(e) =>
                onChange({ durationMins: Number(e.target.value) || 60 })
              }
            >
              {(durationOptions.length ? durationOptions : [60, 90, 120]).map(
                (m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ),
              )}
            </select>
          </label>
          <div />
        </div>

        <div className="auto-param-block">
          <div className="auto-param-head">
            <span>{labels.weeks}</span>
            <ModeToggle
              value={draft.weekMode}
              onChange={(weekMode) => onChange({ weekMode })}
              autoLabel={labels.modeAuto}
              manualLabel={labels.modeManual}
            />
          </div>
          {draft.weekMode === "manual" ? (
            <label className="field">
              <span>{labels.weeks}</span>
              <input
                value={draft.weekPattern}
                onChange={(e) => onChange({ weekPattern: e.target.value })}
                placeholder="1-14"
              />
            </label>
          ) : (
            <p className="auto-param-hint">{labels.weeksHint}</p>
          )}
        </div>

        <div className="auto-param-block">
          <div className="auto-param-head">
            <span>{labels.day}</span>
            <ModeToggle
              value={draft.dayMode}
              onChange={(dayMode) => onChange({ dayMode })}
              autoLabel={labels.modeAuto}
              manualLabel={labels.modeManual}
            />
          </div>
          {draft.dayMode === "manual" ? (
            <div className="auto-day-picks">
              {DAYS.map((d) => {
                const on = draft.preferredDays.includes(d);
                return (
                  <label key={d} className="auto-check">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        const next = on
                          ? draft.preferredDays.filter((x) => x !== d)
                          : [...draft.preferredDays, d];
                        onChange({ preferredDays: next });
                      }}
                    />
                    {d}
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="auto-param-hint">{labels.dayHint}</p>
          )}
        </div>

        <div className="auto-param-block">
          <div className="auto-param-head">
            <span>{labels.timeSlot}</span>
            <ModeToggle
              value={draft.timeMode}
              onChange={(timeMode) => onChange({ timeMode })}
              autoLabel={labels.modeAuto}
              manualLabel={labels.modeManual}
            />
          </div>
          {draft.timeMode === "manual" ? (
            <label className="field">
              <span>{labels.slot}</span>
              <select
                value={`${draft.preferredStart}-${draft.preferredEnd}`}
                onChange={(e) => {
                  const [start, end] = e.target.value.split("-");
                  onChange({
                    preferredStart: start || "08:00",
                    preferredEnd: end || "09:00",
                  });
                }}
              >
                {slotsForDuration.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="auto-param-hint">{labels.timeHint}</p>
          )}
        </div>

        <div className="auto-param-block">
          <div className="auto-param-head">
            <span>{labels.lecturer}</span>
            <ModeToggle
              value={draft.lecturerMode}
              onChange={(lecturerMode) => onChange({ lecturerMode })}
              autoLabel={labels.modeAuto}
              manualLabel={labels.modeManual}
            />
          </div>
          {draft.lecturerMode === "manual" ? (
            <label className="field">
              <span>{labels.lecturer}</span>
              <input
                value={draft.preferredLecturerIds[0] ?? ""}
                onChange={(e) =>
                  onChange({
                    preferredLecturerIds: e.target.value
                      ? [e.target.value]
                      : [],
                  })
                }
                placeholder={labels.lecturerPh}
              />
            </label>
          ) : (
            <p className="auto-param-hint">{labels.lecturerHint}</p>
          )}
        </div>

        <div className="auto-param-block">
          <div className="auto-param-head">
            <span>{labels.room}</span>
            <ModeToggle
              value={draft.roomMode}
              onChange={(roomMode) => onChange({ roomMode })}
              autoLabel={labels.modeAuto}
              manualLabel={labels.modeManual}
            />
          </div>
          {draft.roomMode === "manual" ? (
            <label className="field">
              <span>{labels.room}</span>
              <select
                value={draft.preferredRoomCodes[0] ?? ""}
                onChange={(e) =>
                  onChange({
                    preferredRoomCodes: e.target.value ? [e.target.value] : [],
                  })
                }
              >
                <option value="">{labels.pickRoom}</option>
                {rooms
                  .filter((r) => r.inUse)
                  .slice(0, 400)
                  .map((r) => (
                    <option key={r.id} value={r.roomCode}>
                      {r.roomCode}
                      {r.shortName ? ` — ${r.shortName}` : ""}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <p className="auto-param-hint">{labels.roomHint}</p>
          )}
        </div>

        <label className="auto-check" style={{ marginTop: "0.75rem" }}>
          <input
            type="checkbox"
            checked={draft.consecutive}
            onChange={(e) => onChange({ consecutive: e.target.checked })}
          />
          {labels.consecutive}
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {labels.cancel}
          </button>
          <button type="button" className="btn" onClick={onSave}>
            {labels.save}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
