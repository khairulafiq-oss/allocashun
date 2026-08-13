import { createPortal } from "react-dom";
import { resolveImportCalendar } from "../lib/scheduleCalendar";
import { parseWeeks, teachingWeekDateRanges } from "../lib/weeks";
import type { AcademicCalendar, ScheduleEntry } from "../types";

type Props = {
  open: boolean;
  entries: ScheduleEntry[];
  calendars: AcademicCalendar[];
  labels: {
    title: string;
    close: string;
    day: string;
    time: string;
    faculty: string;
    module: string;
    moduleName: string;
    offering: string;
    activity: string;
    lecturer: string;
    room: string;
    weeks: string;
    academicYear: string;
    period: string;
    meetings: string;
    teachingDates: string;
    noDates: string;
  };
  onClose: () => void;
};

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(key);
  }
  return out;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ScheduleDetailDialog({
  open,
  entries,
  calendars,
  labels,
  onClose,
}: Props) {
  if (!open || entries.length === 0) return null;

  const primary = entries[0];
  const offerings = unique(entries.map((e) => e.modOffCode));
  const lecturers = unique(entries.map((e) => e.lecturer ?? ""));
  const weekNums = parseWeeks(primary.weeks);
  const calendar = resolveImportCalendar(
    primary.academicYear,
    primary.periodSlot,
    calendars,
  );
  const weekWindows = calendar
    ? teachingWeekDateRanges(calendar).filter((win) =>
        weekNums.includes(win.week),
      )
    : [];

  return createPortal(
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal-wide tt-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tt-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tt-detail-head">
          <div>
            <h3 id="tt-detail-title">{labels.title}</h3>
            <p className="tt-detail-hero-time">
              {primary.day} · {primary.startTime} – {primary.endTime}
            </p>
            <p className="tt-detail-hero-sub">
              {primary.activityName || primary.activityCode}
              {primary.moduleCode ? ` · ${primary.moduleCode}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
          >
            {labels.close}
          </button>
        </div>

        <dl className="tt-detail-grid">
          <div>
            <dt>{labels.day}</dt>
            <dd>{primary.day}</dd>
          </div>
          <div>
            <dt>{labels.time}</dt>
            <dd>
              {primary.startTime} – {primary.endTime}
            </dd>
          </div>
          <div>
            <dt>{labels.faculty}</dt>
            <dd>
              {primary.facultyCode}
              {primary.facultyName ? `, ${primary.facultyName}` : ""}
            </dd>
          </div>
          <div>
            <dt>{labels.module}</dt>
            <dd>{primary.moduleCode}</dd>
          </div>
          <div className="tt-detail-span">
            <dt>{labels.moduleName}</dt>
            <dd>{primary.moduleName || "—"}</dd>
          </div>
          <div className="tt-detail-span">
            <dt>{labels.offering}</dt>
            <dd>
              {offerings.length === 0 ? (
                "—"
              ) : (
                <ul className="tt-detail-list">
                  {offerings.map((code) => (
                    <li key={code}>{code}</li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
          <div>
            <dt>{labels.activity}</dt>
            <dd>
              {primary.activityCode}
              {primary.activityName ? ` — ${primary.activityName}` : ""}
            </dd>
          </div>
          <div className="tt-detail-span">
            <dt>{labels.lecturer}</dt>
            <dd>
              {lecturers.length === 0 ? (
                "—"
              ) : (
                <ul className="tt-detail-list">
                  {lecturers.map((lec) => (
                    <li key={lec}>{lec}</li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
          <div className="tt-detail-span">
            <dt>{labels.room}</dt>
            <dd>
              {primary.roomCode}
              {primary.roomName ? `, ${primary.roomName}` : ""}
            </dd>
          </div>
          <div>
            <dt>{labels.academicYear}</dt>
            <dd>{primary.academicYear || "—"}</dd>
          </div>
          <div>
            <dt>{labels.period}</dt>
            <dd>{primary.periodSlot || "—"}</dd>
          </div>
          <div>
            <dt>{labels.weeks}</dt>
            <dd>w{primary.weeks || "—"}</dd>
          </div>
          <div>
            <dt>{labels.meetings}</dt>
            <dd>{weekNums.length || "—"}</dd>
          </div>
        </dl>

        <div className="tt-detail-dates">
          <h4>{labels.teachingDates}</h4>
          {weekWindows.length === 0 ? (
            <p className="tt-detail-dates-empty">{labels.noDates}</p>
          ) : (
            <ul className="tt-detail-week-list">
              {weekWindows.map((win) => (
                <li key={win.week}>
                  <strong>Week {win.week}</strong>
                  <span>
                    {formatDate(win.start)} – {formatDate(win.end)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
