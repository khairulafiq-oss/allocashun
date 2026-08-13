import { useMemo } from "react";
import { timeToMinutes } from "../lib/timeSlots";
import { parseWeeks } from "../lib/weeks";
import type { ScheduleEntry } from "../types";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PX_PER_MIN = 1.1;

function dayKey(day: string): string {
  const key = day.slice(0, 3);
  return (
    DAY_ORDER.find((d) => d.toLowerCase() === key.toLowerCase()) ?? key
  );
}

function activityTone(activityCode: string, activityName: string): string {
  const hay = `${activityCode} ${activityName}`.toUpperCase();
  if (hay.includes("LAB") || hay.includes("PRA") || hay.includes("PRACTICAL")) {
    return "lab";
  }
  if (hay.includes("TUT") || hay.includes("TUTORIAL")) return "tut";
  if (hay.includes("SEM") || hay.includes("SEMINAR")) return "sem";
  if (hay.includes("EXAM")) return "exam";
  if (hay.includes("ONL") || hay.includes("ONLINE")) return "onl";
  return "lec";
}

function overlaps(
  a: ScheduleEntry,
  b: ScheduleEntry,
): boolean {
  if (dayKey(a.day) !== dayKey(b.day)) return false;
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);
  return aStart < bEnd && aEnd > bStart;
}

type DisplayEntry = ScheduleEntry & { sourceIds: string[] };

/** Same slot pattern; different offered groups and/or lecturers → one block. */
function jointPatternKey(row: ScheduleEntry): string {
  return [
    dayKey(row.day),
    row.startTime,
    row.endTime,
    row.roomCode.trim().toUpperCase(),
    String(row.weeks ?? "").trim(),
    row.activityCode.trim().toUpperCase(),
    row.moduleCode.trim().toUpperCase(),
    row.facultyCode.trim().toUpperCase(),
    (row.academicYear ?? "").trim(),
    (row.periodSlot ?? "").trim().toUpperCase(),
  ].join("|");
}

function mergeJointDisplayEntries(entries: ScheduleEntry[]): DisplayEntry[] {
  const groups = new Map<string, ScheduleEntry[]>();
  for (const row of entries) {
    const key = jointPatternKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const merged: DisplayEntry[] = [];
  for (const list of groups.values()) {
    if (list.length === 1) {
      const only = list[0];
      merged.push({ ...only, sourceIds: [only.id] });
      continue;
    }

    const sorted = [...list].sort((a, b) =>
      a.modOffCode.localeCompare(b.modOffCode, undefined, {
        numeric: true,
        sensitivity: "base",
      }) ||
      (a.lecturer ?? "").localeCompare(b.lecturer ?? "", undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
    const primary = sorted[0];
    const modOffCodes = [...new Set(sorted.map((r) => r.modOffCode))];
    const occurrences = [
      ...new Set(sorted.map((r) => r.occurrence).filter(Boolean)),
    ];
    const lecturers = [
      ...new Set(
        sorted
          .map((r) => (r.lecturer ?? "").trim())
          .filter(Boolean),
      ),
    ];
    merged.push({
      ...primary,
      id: `joint:${sorted.map((r) => r.id).join("|")}`,
      modOffCode: modOffCodes.join(", "),
      occurrence: occurrences.join(", "),
      lecturer: lecturers.join(", "),
      sourceIds: sorted.map((r) => r.id),
    });
  }

  return merged;
}

function anyIdInSet(ids: string[], set?: Set<string>): boolean {
  if (!set || set.size === 0) return false;
  return ids.some((id) => set.has(id));
}

function allIdsInSet(ids: string[], set?: Set<string>): boolean {
  if (!set || ids.length === 0) return false;
  return ids.every((id) => set.has(id));
}

/** Assign lane indexes for concurrent events within the same day. */
function assignLanes(rows: ScheduleEntry[]): Map<string, { lane: number; lanes: number }> {
  const byDay = new Map<string, ScheduleEntry[]>();
  for (const row of rows) {
    const key = dayKey(row.day);
    const list = byDay.get(key) ?? [];
    list.push(row);
    byDay.set(key, list);
  }

  const result = new Map<string, { lane: number; lanes: number }>();

  for (const list of byDay.values()) {
    const sorted = [...list].sort(
      (a, b) =>
        timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
        timeToMinutes(a.endTime) - timeToMinutes(b.endTime),
    );
    const laneEnds: number[] = [];
    const laneOf = new Map<string, number>();

    for (const row of sorted) {
      const start = timeToMinutes(row.startTime);
      const end = timeToMinutes(row.endTime);
      let lane = laneEnds.findIndex((e) => e <= start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(end);
      } else {
        laneEnds[lane] = end;
      }
      laneOf.set(row.id, lane);
    }

    const clusters: ScheduleEntry[][] = [];
    for (const row of sorted) {
      let placed = false;
      for (const cluster of clusters) {
        if (cluster.some((other) => overlaps(row, other))) {
          cluster.push(row);
          placed = true;
          break;
        }
      }
      if (!placed) clusters.push([row]);
    }

    for (const cluster of clusters) {
      const maxLane =
        Math.max(...cluster.map((r) => laneOf.get(r.id) ?? 0), 0) + 1;
      for (const row of cluster) {
        result.set(row.id, {
          lane: laneOf.get(row.id) ?? 0,
          lanes: maxLane,
        });
      }
    }
  }

  return result;
}

type Props = {
  entries: ScheduleEntry[];
  emptyLabel: string;
  removeLabel?: string;
  onRemove?: (id: string) => void;
  /** Open detail for the underlying source entries of a (possibly joint) block. */
  onBlockClick?: (entries: ScheduleEntry[]) => void;
  days?: string[];
  warnIds?: Set<string>;
  previewIds?: Set<string>;
  removableIds?: Set<string>;
  opacityById?: Map<string, number>;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  selectableIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
};

export function WeekTimetableGrid({
  entries,
  emptyLabel,
  removeLabel,
  onRemove,
  onBlockClick,
  days = ["Mon", "Tue", "Wed", "Thu", "Fri"],
  warnIds,
  previewIds,
  removableIds,
  opacityById,
  selectMode,
  selectedIds,
  selectableIds,
  onToggleSelect,
}: Props) {
  const displayEntries = useMemo(
    () => mergeJointDisplayEntries(entries),
    [entries],
  );

  const entriesById = useMemo(() => {
    const map = new Map<string, ScheduleEntry>();
    for (const row of entries) map.set(row.id, row);
    return map;
  }, [entries]);

  const bounds = useMemo(() => {
    let min = 8 * 60;
    let max = 18 * 60;
    for (const row of displayEntries) {
      const start = timeToMinutes(row.startTime);
      const end = timeToMinutes(row.endTime);
      if (Number.isFinite(start)) min = Math.min(min, start);
      if (Number.isFinite(end)) max = Math.max(max, end);
    }
    min = Math.floor(min / 60) * 60;
    max = Math.ceil(max / 60) * 60;
    if (max <= min) max = min + 60;
    return { min, max };
  }, [displayEntries]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let m = bounds.min; m < bounds.max; m += 60) list.push(m);
    return list;
  }, [bounds]);

  const lanes = useMemo(() => assignLanes(displayEntries), [displayEntries]);

  const height = (bounds.max - bounds.min) * PX_PER_MIN;

  const legend = useMemo(() => {
    const set = new Map<string, string>();
    for (const row of displayEntries) {
      const tone = activityTone(row.activityCode, row.activityName);
      if (!set.has(tone)) set.set(tone, row.activityName || row.activityCode);
    }
    return Array.from(set.entries());
  }, [displayEntries]);

  if (displayEntries.length === 0) {
    return <div className="empty-note">{emptyLabel}</div>;
  }

  return (
    <div className="tt-week">
      <div
        className="tt-week-grid"
        style={{
          gridTemplateColumns: `52px repeat(${days.length}, minmax(120px, 1fr))`,
        }}
      >
        <div className="tt-week-corner" />
        {days.map((d) => (
          <div key={d} className="tt-week-dayhead">
            {d}
          </div>
        ))}

        <div className="tt-week-times" style={{ height }}>
          {hours.map((m) => (
            <div
              key={m}
              className="tt-week-hour"
              style={{ top: (m - bounds.min) * PX_PER_MIN }}
            >
              {String(Math.floor(m / 60)).padStart(2, "0")}
            </div>
          ))}
        </div>

        {days.map((d) => {
          const dayRows = displayEntries.filter((row) => dayKey(row.day) === d);
          return (
            <div key={d} className="tt-week-col" style={{ height }}>
              {hours.map((m) => (
                <div
                  key={m}
                  className="tt-week-line"
                  style={{ top: (m - bounds.min) * PX_PER_MIN }}
                />
              ))}
              {dayRows.map((row) => {
                const start = timeToMinutes(row.startTime);
                const end = timeToMinutes(row.endTime);
                const top = (start - bounds.min) * PX_PER_MIN;
                const blockHeight = Math.max(28, (end - start) * PX_PER_MIN);
                const laneInfo = lanes.get(row.id) ?? { lane: 0, lanes: 1 };
                const widthPct = 100 / laneInfo.lanes;
                const leftPct = laneInfo.lane * widthPct;
                const tone = activityTone(row.activityCode, row.activityName);
                const isWarn = anyIdInSet(row.sourceIds, warnIds);
                const isPreview = anyIdInSet(row.sourceIds, previewIds);
                const opacity = (() => {
                  if (!opacityById) return 1;
                  let best: number | null = null;
                  for (const id of row.sourceIds) {
                    const next = opacityById.get(id);
                    if (next == null) continue;
                    best = best == null ? next : Math.max(best, next);
                  }
                  return best ?? 1;
                })();
                const meetingCount = parseWeeks(row.weeks).length;
                const isSelectable =
                  !!selectMode &&
                  !!onToggleSelect &&
                  row.sourceIds.every(
                    (id) => !selectableIds || selectableIds.has(id),
                  );
                const isSelected = allIdsInSet(row.sourceIds, selectedIds);
                const canRemove =
                  !!onRemove &&
                  !selectMode &&
                  row.sourceIds.every(
                    (id) => !removableIds || removableIds.has(id),
                  );
                const canOpenDetail =
                  !selectMode && !!onBlockClick && !isPreview;

                return (
                  <article
                    key={row.id}
                    className={`tt-week-block tone-${tone}${isWarn ? " clash" : ""}${
                      isPreview ? " preview" : ""
                    }${isSelectable ? " selectable" : ""}${isSelected ? " selected" : ""}${
                      canOpenDetail ? " clickable" : ""
                    }`}
                    style={{
                      top,
                      height: blockHeight,
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                      opacity,
                    }}
                    title={`${row.activityName} ${row.modOffCode}\n${row.startTime}-${row.endTime}\n${row.roomName || row.roomCode}\nw${row.weeks}${meetingCount ? ` · ${meetingCount} meetings` : ""}`}
                    onClick={
                      isSelectable
                        ? () => {
                            for (const id of row.sourceIds) {
                              const isOn = selectedIds?.has(id) ?? false;
                              if (isSelected && isOn) onToggleSelect(id);
                              if (!isSelected && !isOn) onToggleSelect(id);
                            }
                          }
                        : canOpenDetail
                          ? () => {
                              const sources = row.sourceIds
                                .map((id) => entriesById.get(id))
                                .filter((e): e is ScheduleEntry => !!e);
                              if (sources.length > 0) onBlockClick(sources);
                            }
                          : undefined
                    }
                    role={
                      isSelectable || canOpenDetail ? "button" : undefined
                    }
                    aria-pressed={isSelectable ? isSelected : undefined}
                  >
                    {isSelectable ? (
                      <span className="tt-week-check" aria-hidden="true">
                        {isSelected ? "✓" : ""}
                      </span>
                    ) : null}
                    <strong>
                      {row.activityName} {row.modOffCode}
                    </strong>
                    <span>{row.lecturer || "—"}</span>
                    <span>{row.roomName || row.roomCode}</span>
                    <span>
                      {row.startTime} - {row.endTime}
                    </span>
                    <span>w{row.weeks}</span>
                    {meetingCount > 0 ? (
                      <em className="tt-week-meetings" title={`${meetingCount} meetings`}>
                        {meetingCount}
                      </em>
                    ) : null}
                    {canRemove ? (
                      <button
                        type="button"
                        className="tt-week-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          for (const id of row.sourceIds) onRemove(id);
                        }}
                        aria-label={removeLabel ?? "Remove"}
                      >
                        ×
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          );
        })}
      </div>

      {legend.length > 0 ? (
        <div className="tt-week-legend">
          {legend.map(([tone, label]) => (
            <span key={tone} className={`tt-week-legend-item tone-${tone}`}>
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
