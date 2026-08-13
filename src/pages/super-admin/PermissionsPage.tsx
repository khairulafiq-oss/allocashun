import { useState } from "react";
import { FlashBanner } from "../../components/FlashBanner";
import { useLanguage } from "../../i18n/LanguageContext";
import { useStore } from "../../state/StoreContext";
import type { PermissionAction, Role } from "../../types";

const ROLES: Role[] = [
  "super_admin",
  "admin",
  "central_user",
  "faculty_user",
  "viewer",
];

const ACTIONS: { id: PermissionAction; key: "permRead" | "permWrite" | "permApprove" | "permLock" | "permPublish" }[] = [
  { id: "read", key: "permRead" },
  { id: "write", key: "permWrite" },
  { id: "approve", key: "permApprove" },
  { id: "lock", key: "permLock" },
  { id: "publish", key: "permPublish" },
];

export function PermissionsPage() {
  const { t } = useLanguage();
  const { permissions, setPermissions, pushAudit, setFlash } = useStore();
  const [draft, setDraft] = useState(permissions);

  function toggle(role: Role, action: PermissionAction) {
    if (role === "super_admin") return;
    setDraft((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [action]: !prev[role][action],
      },
    }));
  }

  function save() {
    setPermissions(draft);
    pushAudit("PERMISSION_MATRIX", "Updated role permission matrix");
    setFlash({ kind: "ok", message: t.permSaved });
  }

  return (
    <>
      <FlashBanner />
      <div className="panel">
        <h2>{t.permTitle}</h2>
        <p className="lead">{t.permLede}</p>

        <div className="perm-grid table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t.usersRole}</th>
                {ACTIONS.map((a) => (
                  <th key={a.id}>{t[a.key]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLES.map((role) => (
                <tr key={role}>
                  <td>{t[`role_${role}`]}</td>
                  {ACTIONS.map((a) => (
                    <td key={a.id}>
                      <input
                        type="checkbox"
                        checked={draft[role][a.id]}
                        disabled={role === "super_admin"}
                        onChange={() => toggle(role, a.id)}
                        aria-label={`${role} ${a.id}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button type="button" className="btn" style={{ marginTop: "1rem" }} onClick={save}>
          {t.permSave}
        </button>
      </div>
    </>
  );
}
