import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FlashBanner } from "../../components/FlashBanner";
import { useLanguage } from "../../i18n/LanguageContext";
import { useStore } from "../../state/StoreContext";

export function SystemPage() {
  const { t } = useLanguage();
  const {
    system,
    setSystem,
    calendars,
    timeRules,
    security,
    permissions,
    pushAudit,
    setFlash,
    setStats,
  } = useStore();
  const [draft, setDraft] = useState(system);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setSystem(draft);
    pushAudit("SYSTEM_INTEGRATION", `Updated SITS/VBA integration settings`);
    setFlash({ kind: "ok", message: t.sysSaved });
  }

  function exportConfig() {
    const payload = {
      calendars,
      timeRules,
      security,
      system: draft,
      permissions,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "um-timetable-config.json";
    a.click();
    URL.revokeObjectURL(url);
    pushAudit("SYSTEM_EXPORT", "Exported control-plane config JSON");
  }

  function importConfig() {
    pushAudit("SYSTEM_IMPORT", "Accepted mock config import");
    setFlash({ kind: "ok", message: t.sysImportDone });
  }

  function resetSemester() {
    setStats({ draftSchedules: 0, lockedSchedules: 0 });
    pushAudit("SEMESTER_RESET", "Cleared draft boards and lock flags (mock)");
    setFlash({ kind: "ok", message: t.sysResetDone });
    setConfirmOpen(false);
  }

  return (
    <>
      <FlashBanner />
      <div className="panel">
        <h2>{t.sysTitle}</h2>
        <p className="lead">{t.sysLede}</p>

        <form onSubmit={save}>
          <div className="field">
            <label htmlFor="sits">{t.sysSits}</label>
            <input
              id="sits"
              value={draft.sitsEndpoint}
              onChange={(e) =>
                setDraft({ ...draft, sitsEndpoint: e.target.value })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="vba">{t.sysVba}</label>
            <input
              id="vba"
              value={draft.vbaEnginePath}
              onChange={(e) =>
                setDraft({ ...draft, vbaEnginePath: e.target.value })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="fmt">{t.sysExport}</label>
            <select
              id="fmt"
              value={draft.exportFormat}
              onChange={(e) =>
                setDraft({ ...draft, exportFormat: e.target.value })
              }
            >
              <option value="CSV">CSV</option>
              <option value="XLSX">XLSX</option>
              <option value="JSON">JSON</option>
            </select>
          </div>
          <button type="submit" className="btn">
            {t.sysSave}
          </button>
        </form>
      </div>

      <div className="panel">
        <div className="chip-row">
          <button type="button" className="btn btn-ghost" onClick={exportConfig}>
            {t.sysExportCfg}
          </button>
          <button type="button" className="btn btn-ghost" onClick={importConfig}>
            {t.sysImportCfg}
          </button>
        </div>
      </div>

      <div className="panel">
        <h2 style={{ fontSize: "1.2rem" }}>{t.sysReset}</h2>
        <p className="lead">{t.sysResetHelp}</p>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => setConfirmOpen(true)}
        >
          {t.sysReset}
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t.sysResetConfirm}
        body={t.sysResetBody}
        confirmLabel={t.sysConfirm}
        cancelLabel={t.sysCancel}
        danger
        onCancel={() => setConfirmOpen(false)}
        onConfirm={resetSemester}
      />
    </>
  );
}
