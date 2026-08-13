import { useState } from "react";
import { FlashBanner } from "../../components/FlashBanner";
import { useLanguage } from "../../i18n/LanguageContext";
import { useStore } from "../../state/StoreContext";
import type { Role, UserAccount } from "../../types";

const ROLES: Role[] = [
  "super_admin",
  "admin",
  "central_user",
  "faculty_user",
  "viewer",
];

export function UsersPage() {
  const { t } = useLanguage();
  const { users, setUsers, faculties, pushAudit, setFlash } = useStore();
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "faculty_user" as Role,
    facultyCode: "W",
  });

  const roleLabel = (role: Role) => t[`role_${role}`];

  const visible =
    roleFilter === "all" ? users : users.filter((u) => u.role === roleFilter);

  function addUser(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    const next: UserAccount = {
      id: `u${Date.now()}`,
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
      facultyCode: form.role === "faculty_user" ? form.facultyCode : null,
      active: true,
    };
    setUsers((prev) => [next, ...prev]);
    pushAudit("USER_CREATE", `Created ${next.email} as ${next.role}`);
    setFlash({ kind: "ok", message: t.usersSaved });
    setForm({
      name: "",
      email: "",
      role: "faculty_user",
      facultyCode: faculties[0]?.facultyCode ?? "W",
    });
  }

  function toggleActive(id: string) {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, active: !u.active } : u)),
    );
    const user = users.find((u) => u.id === id);
    if (user) {
      pushAudit(
        "USER_STATUS",
        `${user.email} → ${user.active ? "inactive" : "active"}`,
      );
    }
  }

  function changeRole(id: string, role: Role) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              role,
              facultyCode:
                role === "faculty_user"
                  ? u.facultyCode ?? faculties[0]?.facultyCode ?? null
                  : null,
            }
          : u,
      ),
    );
    pushAudit("USER_ROLE_CHANGE", `Role set to ${role} for ${id}`);
  }

  function changeFaculty(id: string, facultyCode: string) {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, facultyCode } : u)),
    );
  }

  function resetPassword(email: string) {
    pushAudit("USER_PASSWORD_RESET", `Reset queued for ${email}`);
    setFlash({ kind: "ok", message: t.usersResetDone });
  }

  return (
    <>
      <FlashBanner />
      <div className="panel">
        <h2>{t.usersTitle}</h2>
        <p className="lead">{t.usersLede}</p>

        <form onSubmit={addUser} className="toolbar">
          <div className="field">
            <label htmlFor="name">{t.usersName}</label>
            <input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="email">{t.usersEmail}</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="role">{t.usersRole}</label>
            <select
              id="role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>
          {form.role === "faculty_user" && (
            <div className="field">
              <label htmlFor="fac">{t.usersFaculty}</label>
              <select
                id="fac"
                value={form.facultyCode}
                onChange={(e) => setForm({ ...form, facultyCode: e.target.value })}
              >
                {faculties.map((f) => (
                  <option key={f.id} value={f.facultyCode}>
                    {f.facultyCode} · {f.shortName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="submit" className="btn btn-sm">
            {t.usersAdd}
          </button>
        </form>

        <div className="toolbar">
          <div className="field">
            <label htmlFor="filter">{t.usersRole}</label>
            <select
              id="filter"
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value === "all" ? "all" : (e.target.value as Role))
              }
            >
              <option value="all">{t.usersAllRoles}</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t.usersName}</th>
                <th>{t.usersEmail}</th>
                <th>{t.usersRole}</th>
                <th>{t.usersFaculty}</th>
                <th>{t.usersStatus}</th>
                <th>{t.usersActions}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value as Role)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {u.role === "faculty_user" ? (
                      <select
                        value={u.facultyCode ?? ""}
                        onChange={(e) => changeFaculty(u.id, e.target.value)}
                      >
                        {faculties.map((f) => (
                          <option key={f.id} value={f.facultyCode}>
                            {f.facultyCode} · {f.shortName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      t.usersNone
                    )}
                  </td>
                  <td>
                    <span className={`badge ${u.active ? "badge-ok" : "badge-off"}`}>
                      {u.active ? t.usersActive : t.usersInactive}
                    </span>
                  </td>
                  <td>
                    <div className="chip-row">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => toggleActive(u.id)}
                      >
                        {t.usersToggle}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => resetPassword(u.email)}
                      >
                        {t.usersResetPw}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
