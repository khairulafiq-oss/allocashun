import { useState } from "react";
import { FlashBanner } from "../../components/FlashBanner";
import { useLanguage } from "../../i18n/LanguageContext";
import { useStore } from "../../state/StoreContext";

export function SecurityPage() {
  const { t } = useLanguage();
  const { security, setSecurity, pushAudit, setFlash } = useStore();
  const [draft, setDraft] = useState(security);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setSecurity(draft);
    pushAudit(
      "SECURITY_UPDATE",
      `2FA=${draft.twoFactorEnabled}; maintenance=${draft.maintenanceMode}; timeout=${draft.sessionTimeoutMins}m`,
    );
    setFlash({ kind: "ok", message: t.secSaved });
  }

  return (
    <>
      <FlashBanner />
      <div className="panel">
        <h2>{t.secTitle}</h2>
        <p className="lead">{t.secLede}</p>
        <form onSubmit={save}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="minlen">{t.secMinLen}</label>
              <input
                id="minlen"
                type="number"
                min={8}
                max={32}
                value={draft.minPasswordLength}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    minPasswordLength: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="timeout">{t.secTimeout}</label>
              <input
                id="timeout"
                type="number"
                min={5}
                max={240}
                value={draft.sessionTimeoutMins}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    sessionTimeoutMins: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="attempts">{t.secAttempts}</label>
              <input
                id="attempts"
                type="number"
                min={3}
                max={20}
                value={draft.maxLoginAttempts}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    maxLoginAttempts: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="retention">{t.secRetention}</label>
              <input
                id="retention"
                type="number"
                min={30}
                max={1825}
                value={draft.auditRetentionDays}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    auditRetentionDays: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="toggle-row">
            <div>
              <strong>{t.secUpper}</strong>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.requireUppercase}
                onChange={(e) =>
                  setDraft({ ...draft, requireUppercase: e.target.checked })
                }
              />
              <span />
            </label>
          </div>
          <div className="toggle-row">
            <div>
              <strong>{t.secNumber}</strong>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.requireNumber}
                onChange={(e) =>
                  setDraft({ ...draft, requireNumber: e.target.checked })
                }
              />
              <span />
            </label>
          </div>
          <div className="toggle-row">
            <div>
              <strong>{t.secSymbol}</strong>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.requireSymbol}
                onChange={(e) =>
                  setDraft({ ...draft, requireSymbol: e.target.checked })
                }
              />
              <span />
            </label>
          </div>
          <div className="toggle-row">
            <div>
              <strong>{t.sec2fa}</strong>
              <p>{t.sec2faHelp}</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.twoFactorEnabled}
                onChange={(e) =>
                  setDraft({ ...draft, twoFactorEnabled: e.target.checked })
                }
              />
              <span />
            </label>
          </div>
          <div className="toggle-row">
            <div>
              <strong>{t.secMaint}</strong>
              <p>{t.secMaintHelp}</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.maintenanceMode}
                onChange={(e) =>
                  setDraft({ ...draft, maintenanceMode: e.target.checked })
                }
              />
              <span />
            </label>
          </div>

          <button type="submit" className="btn" style={{ marginTop: "1rem" }}>
            {t.secSave}
          </button>
        </form>
      </div>
    </>
  );
}
