import { createPortal } from "react-dom";
import type { ImportMode, ImportPreview } from "../lib/scheduleImport";

type Props = {
  open: boolean;
  preview: ImportPreview | null;
  mode: ImportMode;
  importing: boolean;
  allowClashes: boolean;
  onAllowClashes: (next: boolean) => void;
  effectiveReadyCount: number;
  clashesBlockedCount: number;
  labels: {
    title: string;
    lede: string;
    file: string;
    mode: string;
    allowClashes: string;
    clashBlocked: string;
    modeMerge: string;
    modeReplace: string;
    summary: string;
    ready: string;
    warnings: string;
    errors: string;
    line: string;
    status: string;
    detail: string;
    offering: string;
    noRows: string;
    import: string;
    cancel: string;
    downloadErrors: string;
    statusOk: string;
    statusWarning: string;
    statusError: string;
  };
  onModeChange: (mode: ImportMode) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

function csvEscape(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadImportErrors(preview: ImportPreview, labels: Props["labels"]) {
  const errorRows = preview.rows.filter((row) => row.status === "error");
  if (errorRows.length === 0) return;

  const header = [
    labels.line,
    "LineEnd",
    labels.status,
    labels.offering,
    labels.detail,
  ];
  const lines = errorRows.map((row) =>
    [
      String(row.line),
      row.lineEnd != null ? String(row.lineEnd) : "",
      labels.statusError,
      row.entry?.modOffCode ?? "",
      row.messages.join(" | "),
    ]
      .map(csvEscape)
      .join(","),
  );
  const csv = [header.map(csvEscape).join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "");
  a.download = `import-errors-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ScheduleImportDialog({
  open,
  preview,
  mode,
  importing,
  allowClashes,
  onAllowClashes,
  effectiveReadyCount,
  clashesBlockedCount,
  labels,
  onModeChange,
  onCancel,
  onConfirm,
}: Props) {
  if (!open || !preview) return null;

  const canImport = effectiveReadyCount > 0 && !importing;
  const errorCount = preview.errorCount;

  return createPortal(
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="import-title">{labels.title}</h3>
        <p>{labels.lede}</p>
        {preview.mergedNote ? (
          <p className="tt-import-merged-note">{preview.mergedNote}</p>
        ) : null}

        <p className="tt-import-file">
          <strong>{labels.file}:</strong> {preview.fileName}
        </p>

        <div className="tt-import-mode">
          <span>{labels.mode}</span>
          <label>
            <input
              type="radio"
              name="import-mode"
              checked={mode === "merge"}
              onChange={() => onModeChange("merge")}
            />
            {labels.modeMerge}
          </label>
          <label>
            <input
              type="radio"
              name="import-mode"
              checked={mode === "replace"}
              onChange={() => onModeChange("replace")}
            />
            {labels.modeReplace}
          </label>
        </div>

        <div className="tt-import-allowclash">
          <label>
            <input
              type="checkbox"
              checked={allowClashes}
              onChange={(e) => onAllowClashes(e.target.checked)}
            />
            {labels.allowClashes}
          </label>
          {!allowClashes && clashesBlockedCount > 0 ? (
            <span className="tt-import-hint">
              {labels.clashBlocked.replace("{n}", String(clashesBlockedCount))}
            </span>
          ) : null}
        </div>

        <div className="tt-import-summary">
          <span>{labels.ready.replace("{n}", String(effectiveReadyCount))}</span>
          <span className="warn">
            {labels.warnings.replace("{n}", String(preview.warningCount))}
          </span>
          <span className="bad">
            {labels.errors.replace("{n}", String(errorCount))}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => downloadImportErrors(preview, labels)}
            disabled={errorCount === 0 || importing}
          >
            {labels.downloadErrors}
          </button>
        </div>

        {preview.rows.length === 0 ? (
          <div className="empty-note">{labels.noRows}</div>
        ) : (
          <div className="table-wrap tt-import-table-wrap">
            <table className="data-table tt-import-table">
              <thead>
                <tr>
                  <th>{labels.line}</th>
                  <th>{labels.status}</th>
                  <th>{labels.offering}</th>
                  <th>{labels.detail}</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 120).map((row) => (
                  <tr key={`${row.line}-${row.entry?.id ?? "err"}`}>
                    <td>
                      {row.lineEnd ? `${row.line}–${row.lineEnd}` : row.line}
                    </td>
                    <td>
                      <span className={`tt-import-status ${row.status}`}>
                        {row.status === "ok"
                          ? labels.statusOk
                          : row.status === "warning"
                            ? labels.statusWarning
                            : labels.statusError}
                      </span>
                    </td>
                    <td>{row.entry?.modOffCode ?? "—"}</td>
                    <td>{row.messages.join(" · ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {preview.rows.length > 120 ? (
          <p className="tt-import-more">
            {labels.summary.replace("{n}", String(preview.rows.length))}
          </p>
        ) : null}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
            disabled={importing}
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onConfirm}
            disabled={!canImport}
          >
            {labels.import}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
