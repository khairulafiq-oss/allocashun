import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FlashBanner } from "../../components/FlashBanner";
import { useLanguage } from "../../i18n/LanguageContext";
import { useStore } from "../../state/StoreContext";
import { resetFacultiesToSeed } from "../../storage/facultyStorage";
import type { Faculty } from "../../types";

type FacultyDraft = Omit<Faculty, "id">;
type EditorMode = "create" | "edit" | null;

function emptyDraft(): FacultyDraft {
  return {
    facultyCode: "",
    shortName: "",
    fullName: "",
    fullNameBm: "",
    email: "",
    active: true,
  };
}

function toDraft(faculty: Faculty): FacultyDraft {
  return {
    facultyCode: faculty.facultyCode ?? "",
    shortName: faculty.shortName ?? "",
    fullName: faculty.fullName ?? "",
    fullNameBm: faculty.fullNameBm ?? "",
    email: faculty.email ?? "",
    active: Boolean(faculty.active),
  };
}

function normalizeDraft(draft: FacultyDraft): FacultyDraft {
  return {
    facultyCode: draft.facultyCode.trim().toUpperCase(),
    shortName: draft.shortName.trim().toUpperCase(),
    fullName: draft.fullName.trim().toUpperCase(),
    fullNameBm: draft.fullNameBm.trim().toUpperCase(),
    email: draft.email.trim().toLowerCase(),
    active: Boolean(draft.active),
  };
}

function draftsEqual(a: FacultyDraft, b: FacultyDraft): boolean {
  return JSON.stringify(normalizeDraft(a)) === JSON.stringify(normalizeDraft(b));
}

export function OrgStructurePage() {
  const { t } = useLanguage();
  const { faculties, setFaculties, pushAudit, setFlash } = useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [mode, setMode] = useState<EditorMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FacultyDraft | null>(null);
  const [baseline, setBaseline] = useState<FacultyDraft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faculties
      .filter((f) => {
        if (filter === "active" && !f.active) return false;
        if (filter === "inactive" && f.active) return false;
        if (!q) return true;
        const hay = [f.facultyCode, f.shortName, f.fullName, f.fullNameBm, f.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) =>
        a.facultyCode.localeCompare(b.facultyCode, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [faculties, filter, query]);

  const deleting = faculties.find((f) => f.id === deleteId) ?? null;
  const isDirty =
    Boolean(mode && draft && baseline) &&
    !draftsEqual(draft as FacultyDraft, baseline as FacultyDraft);

  useEffect(() => {
    if (!mode) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (deleteId) return;
      if (isDirty) return;
      event.preventDefault();
      closeEditor();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, isDirty, deleteId]);

  function reloadSeed() {
    const next = resetFacultiesToSeed();
    setFaculties(next);
    pushAudit("ORG_FACULTY_RELOAD", "Reloaded faculties from UM CSV seed");
    setFlash({ kind: "ok", message: t.orgReloaded });
  }

  function openCreate() {
    const next = emptyDraft();
    setMode("create");
    setEditingId(null);
    setDraft(next);
    setBaseline(next);
  }

  function openEdit(faculty: Faculty) {
    const next = toDraft(faculty);
    setMode("edit");
    setEditingId(faculty.id);
    setDraft(next);
    setBaseline(next);
  }

  function closeEditor() {
    setMode(null);
    setEditingId(null);
    setDraft(null);
    setBaseline(null);
  }

  function saveEditor() {
    if (!draft || !mode) return;
    const next = normalizeDraft(draft);
    if (!next.facultyCode || !next.shortName || !next.fullName) {
      setFlash({ kind: "bad", message: t.orgEditIncomplete });
      return;
    }

    const duplicate = faculties.some(
      (f) =>
        f.facultyCode.toUpperCase() === next.facultyCode &&
        f.id !== editingId,
    );
    if (duplicate) {
      setFlash({ kind: "bad", message: t.orgDuplicate });
      return;
    }

    if (mode === "create") {
      const created: Faculty = {
        id: `fac-${next.facultyCode}-${Date.now()}`,
        ...next,
      };
      setFaculties((prev) => [created, ...prev]);
      pushAudit(
        "ORG_FACULTY_ADD",
        `Created faculty ${created.facultyCode} (${created.shortName})`,
      );
      setFlash({ kind: "ok", message: t.orgCreated });
    } else if (mode === "edit" && editingId) {
      setFaculties((prev) =>
        prev.map((f) => (f.id === editingId ? { ...f, ...next } : f)),
      );
      pushAudit("ORG_FACULTY_UPDATE", `Updated faculty ${next.facultyCode}`);
      setFlash({ kind: "ok", message: t.orgUpdated });
    }
    closeEditor();
  }

  function confirmDelete() {
    if (!deleting) return;
    setFaculties((prev) => prev.filter((f) => f.id !== deleting.id));
    pushAudit("ORG_FACULTY_REMOVE", `Deleted faculty ${deleting.facultyCode}`);
    setFlash({ kind: "ok", message: t.orgDeleted });
    setDeleteId(null);
  }

  function patchDraft<K extends keyof FacultyDraft>(
    key: K,
    value: FacultyDraft[K],
  ) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const editor =
    mode && draft
      ? createPortal(
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={() => {
              if (!isDirty) closeEditor();
            }}
          >
            <div
              className="modal room-edit-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="org-edit-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="org-edit-title">
                {mode === "create" ? t.orgCreateTitle : t.orgEditTitle}
              </h3>
              <p className="lead">
                {mode === "create" ? t.orgCreateLede : t.orgEditLede}
              </p>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="ocode">{t.orgFacultyCode}</label>
                  <input
                    id="ocode"
                    value={draft.facultyCode}
                    onChange={(e) => patchDraft("facultyCode", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="oshort">{t.orgShortName}</label>
                  <input
                    id="oshort"
                    value={draft.shortName}
                    onChange={(e) => patchDraft("shortName", e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="ofull">{t.orgFullName}</label>
                <input
                  id="ofull"
                  value={draft.fullName}
                  onChange={(e) => patchDraft("fullName", e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="ofullbm">{t.orgFullNameBm}</label>
                <input
                  id="ofullbm"
                  value={draft.fullNameBm}
                  onChange={(e) => patchDraft("fullNameBm", e.target.value)}
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="oemail">{t.orgEmail}</label>
                  <input
                    id="oemail"
                    type="email"
                    value={draft.email}
                    onChange={(e) => patchDraft("email", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="oactive">{t.orgActive}</label>
                  <select
                    id="oactive"
                    value={draft.active ? "Y" : "N"}
                    onChange={(e) =>
                      patchDraft("active", e.target.value === "Y")
                    }
                  >
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={closeEditor}
                >
                  {t.sysCancel}
                </button>
                <button type="button" className="btn btn-sm" onClick={saveEditor}>
                  {mode === "create" ? t.orgCreate : t.orgSave}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <FlashBanner />
      <div className="panel">
        <h2>{t.orgTitle}</h2>
        <p className="lead">{t.orgLede}</p>

        <div className="toolbar">
          <div className="field" style={{ minWidth: 200 }}>
            <label htmlFor="oq">{t.orgSearch}</label>
            <input
              id="oq"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.orgSearchPh}
            />
          </div>
          <div className="field">
            <label htmlFor="ofilter">{t.orgActive}</label>
            <select
              id="ofilter"
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as "all" | "active" | "inactive")
              }
            >
              <option value="all">{t.orgFilterAll}</option>
              <option value="active">{t.orgFilterActive}</option>
              <option value="inactive">{t.orgFilterInactive}</option>
            </select>
          </div>
          <button type="button" className="btn btn-sm" onClick={openCreate}>
            {t.orgAdd}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={reloadSeed}>
            {t.orgReloadSeed}
          </button>
        </div>

        <p className="lead" style={{ marginBottom: "0.75rem" }}>
          {t.orgCount
            .replace("{shown}", String(visible.length))
            .replace("{total}", String(faculties.length))}
        </p>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t.orgFacultyCode}</th>
                <th>{t.orgShortName}</th>
                <th>{t.orgFullName}</th>
                <th>{t.orgActive}</th>
                <th>{t.orgFullNameBm}</th>
                <th>{t.orgEmail}</th>
                <th>{t.usersActions}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => (
                <tr key={f.id}>
                  <td>
                    <strong>{f.facultyCode}</strong>
                  </td>
                  <td>{f.shortName}</td>
                  <td>{f.fullName}</td>
                  <td>
                    <span className={`badge ${f.active ? "badge-ok" : "badge-off"}`}>
                      {f.active ? "Y" : "N"}
                    </span>
                  </td>
                  <td>{f.fullNameBm || "—"}</td>
                  <td>{f.email || "—"}</td>
                  <td>
                    <div className="chip-row">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEdit(f)}
                      >
                        {t.orgEdit}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setDeleteId(f.id)}
                      >
                        {t.orgDelete}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editor}

      <ConfirmDialog
        open={Boolean(deleteId && deleting)}
        title={t.orgDeleteTitle}
        body={t.orgDeleteBody.replace("{code}", deleting?.facultyCode ?? "")}
        confirmLabel={t.orgDelete}
        cancelLabel={t.sysCancel}
        danger
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
