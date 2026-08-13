import { useMemo, useState } from "react";
import { FlashBanner } from "../../components/FlashBanner";
import { useLanguage } from "../../i18n/LanguageContext";
import { useStore } from "../../state/StoreContext";

export function AuditLogPage() {
  const { t } = useLanguage();
  const { audit } = useStore();
  const [actor, setActor] = useState("all");

  const actors = useMemo(
    () => Array.from(new Set(audit.map((a) => a.actor))).sort(),
    [audit],
  );

  const rows =
    actor === "all" ? audit : audit.filter((a) => a.actor === actor);

  return (
    <>
      <FlashBanner />
      <div className="panel">
        <h2>{t.auditTitle}</h2>
        <p className="lead">{t.auditLede}</p>

        <div className="toolbar">
          <div className="field">
            <label htmlFor="actor">{t.auditFilter}</label>
            <select
              id="actor"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
            >
              <option value="all">{t.auditAll}</option>
              {actors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="empty-note">{t.auditEmpty}</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t.auditWhen}</th>
                  <th>{t.auditActor}</th>
                  <th>{t.auditAction}</th>
                  <th>{t.auditDetail}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {new Date(row.at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td>{row.actor}</td>
                    <td>
                      <span className="badge">{row.action}</span>
                    </td>
                    <td>{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
