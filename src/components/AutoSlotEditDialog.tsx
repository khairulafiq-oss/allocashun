import { createPortal } from "react-dom";
import type { Activity, Room, ScheduleEntry } from "../types";

type Labels = {
  title: string;
  save: string;
  cancel: string;
  day: string;
  slot: string;
  room: string;
  pickRoom: string;
  lecturer: string;
  activity: string;
  weeks: string;
};

type Props = {
  open: boolean;
  entry: ScheduleEntry | null;
  days: string[];
  slots: string[];
  rooms: Room[];
  activities: Activity[];
  labels: Labels;
  onChange: (partial: Partial<ScheduleEntry>) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function AutoSlotEditDialog({
  open,
  entry,
  days,
  slots,
  rooms,
  activities,
  labels,
  onChange,
  onSave,
  onCancel,
}: Props) {
  if (!open || !entry) return null;

  return createPortal(
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal auto-slot-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-slot-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="auto-slot-edit-title">{labels.title}</h3>
        <p>
          {entry.moduleCode} · {entry.occurrence} · {entry.activityCode}
        </p>

        <div className="field-row">
          <label className="field">
            <span>{labels.day}</span>
            <select
              value={entry.day}
              onChange={(e) => onChange({ day: e.target.value })}
            >
              {days.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{labels.slot}</span>
            <select
              value={`${entry.startTime}-${entry.endTime}`}
              onChange={(e) => {
                const [start, end] = e.target.value.split("-");
                onChange({
                  startTime: start || entry.startTime,
                  endTime: end || entry.endTime,
                  slot: e.target.value,
                });
              }}
            >
              {slots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>{labels.activity}</span>
            <select
              value={entry.activityCode}
              onChange={(e) => {
                const hit = activities.find(
                  (a) => a.activityCode === e.target.value,
                );
                onChange({
                  activityCode: e.target.value,
                  activityName: hit?.activityName || e.target.value,
                });
              }}
            >
              {activities.map((a) => (
                <option key={a.id} value={a.activityCode}>
                  {a.activityCode} — {a.activityName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{labels.weeks}</span>
            <input
              value={entry.weeks}
              onChange={(e) => onChange({ weeks: e.target.value })}
            />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>{labels.room}</span>
            <select
              value={entry.roomCode}
              onChange={(e) => {
                const room = rooms.find((r) => r.roomCode === e.target.value);
                onChange({
                  roomCode: e.target.value,
                  roomName: room?.shortName || room?.fullName || "",
                });
              }}
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
          <label className="field">
            <span>{labels.lecturer}</span>
            <input
              value={entry.lecturer}
              onChange={(e) => onChange({ lecturer: e.target.value })}
            />
          </label>
        </div>

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
