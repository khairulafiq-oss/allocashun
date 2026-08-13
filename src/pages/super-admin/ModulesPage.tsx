import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FlashBanner } from "../../components/FlashBanner";
import { useLanguage } from "../../i18n/LanguageContext";
import { useStore } from "../../state/StoreContext";
import { resetModulesToSeed } from "../../storage/moduleStorage";
import type { Module } from "../../types";

type ModuleDraft = Omit<Module, "id">;
type EditorMode = "create" | "edit" | null;

const PAGE_SIZE = 50;

function emptyDraft(): ModuleDraft {
  return {
    moduleCode: "",
    moduleEngDesc: "",
    moduleMalayDesc: "",
    moduleLevel: "3",
    levelDesc: "",
    moduleType: "B",
    moduleDeptCode: "",
    inUse: true,
    scheme: "UM",
    credit: 3,
    faculty: "",
    facultyDesc: "",
    overallTarget: 0,
    moduleRelated: "",
    active: true,
    isAbstract: false,
  };
}

function toDraft(row: Module): ModuleDraft {
  return {
    moduleCode: row.moduleCode ?? "",
    moduleEngDesc: row.moduleEngDesc ?? "",
    moduleMalayDesc: row.moduleMalayDesc ?? "",
    moduleLevel: row.moduleLevel ?? "",
    levelDesc: row.levelDesc ?? "",
    moduleType: row.moduleType ?? "",
    moduleDeptCode: row.moduleDeptCode ?? "",
    inUse: Boolean(row.inUse),
    scheme: row.scheme ?? "",
    credit: Number(row.credit) || 0,
    faculty: row.faculty ?? "",
    facultyDesc: row.facultyDesc ?? "",
    overallTarget: Number(row.overallTarget) || 0,
    moduleRelated: row.moduleRelated ?? "",
    active: Boolean(row.active),
    isAbstract: Boolean(row.isAbstract),
  };
}

function normalizeDraft(draft: ModuleDraft): ModuleDraft {
  return {
    ...draft,
    moduleCode: draft.moduleCode.trim().toUpperCase(),
    moduleEngDesc: draft.moduleEngDesc.trim().toUpperCase(),
    moduleMalayDesc: draft.moduleMalayDesc.trim().toUpperCase(),
    moduleLevel: draft.moduleLevel.trim(),
    levelDesc: draft.levelDesc.trim(),
    moduleType: draft.moduleType.trim().toUpperCase(),
    moduleDeptCode: draft.moduleDeptCode.trim().toUpperCase(),
    scheme: draft.scheme.trim().toUpperCase(),
    faculty: draft.faculty.trim().toUpperCase(),
    facultyDesc: draft.facultyDesc.trim().toUpperCase(),
    moduleRelated: draft.moduleRelated.trim(),
    credit: Number(draft.credit) || 0,
    overallTarget: Number(draft.overallTarget) || 0,
    inUse: Boolean(draft.inUse),
    active: Boolean(draft.active),
    isAbstract: Boolean(draft.isAbstract),
  };
}

function draftsEqual(a: ModuleDraft, b: ModuleDraft): boolean {
  return JSON.stringify(normalizeDraft(a)) === JSON.stringify(normalizeDraft(b));
}

export function ModulesPage() {
  const { t } = useLanguage();
  const { modules, setModules, paramListsReady, pushAudit, setFlash } =
    useStore();
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [facultyFilter, setFacultyFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<EditorMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ModuleDraft | null>(null);
  const [baseline, setBaseline] = useState<ModuleDraft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const faculties = useMemo(
    () =>
      Array.from(
        new Set(modules.map((row) => row.faculty).filter(Boolean)),
      ).sort(),
    [modules],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return modules
      .filter((row) => {
        if (activeOnly && !row.active) return false;
        if (facultyFilter !== "all" && row.faculty !== facultyFilter) return false;
        if (!q) return true;
        const hay = [
          row.moduleCode,
          row.moduleEngDesc,
          row.moduleMalayDesc,
          row.faculty,
          row.moduleDeptCode,
          row.moduleType,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) =>
        a.moduleCode.localeCompare(b.moduleCode, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [modules, activeOnly, facultyFilter, query]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = visible.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [query, activeOnly, facultyFilter]);

  const deleting = modules.find((row) => row.id === deleteId) ?? null;
  const isDirty =
    Boolean(mode && draft && baseline) &&
    !draftsEqual(draft as ModuleDraft, baseline as ModuleDraft);

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

  async function reloadSeed() {
    const next = await resetModulesToSeed();
    setModules(next);
    pushAudit("MODULE_RELOAD", `Reloaded ${next.length} modules from seed`);
    setFlash({
      kind: "ok",
      message: t.modReloaded.replace("{n}", String(next.length)),
    });
  }

  function openCreate() {
    const next = emptyDraft();
    setMode("create");
    setEditingId(null);
    setDraft(next);
    setBaseline(next);
  }

  function openEdit(row: Module) {
    const next = toDraft(row);
    setMode("edit");
    setEditingId(row.id);
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
    if (!next.moduleCode || !next.moduleEngDesc) {
      setFlash({ kind: "bad", message: t.modEditIncomplete });
      return;
    }

    const duplicate = modules.some(
      (row) =>
        row.moduleCode.toUpperCase() === next.moduleCode &&
        row.id !== editingId,
    );
    if (duplicate) {
      setFlash({ kind: "bad", message: t.modDuplicate });
      return;
    }

    if (mode === "create") {
      const created: Module = {
        id: `mod-${next.moduleCode}-${Date.now()}`,
        ...next,
      };
      setModules((prev) => [created, ...prev]);
      pushAudit("MODULE_CREATE", `Created module ${created.moduleCode}`);
      setFlash({ kind: "ok", message: t.modCreated });
    } else if (mode === "edit" && editingId) {
      setModules((prev) =>
        prev.map((row) => (row.id === editingId ? { ...row, ...next } : row)),
      );
      pushAudit("MODULE_UPDATE", `Updated module ${next.moduleCode}`);
      setFlash({ kind: "ok", message: t.modUpdated });
    }
    closeEditor();
  }

  function confirmDelete() {
    if (!deleting) return;
    setModules((prev) => prev.filter((row) => row.id !== deleting.id));
    pushAudit("MODULE_DELETE", `Deleted module ${deleting.moduleCode}`);
    setFlash({ kind: "ok", message: t.modDeleted });
    setDeleteId(null);
  }

  function patchDraft<K extends keyof ModuleDraft>(
    key: K,
    value: ModuleDraft[K],
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
              aria-labelledby="mod-edit-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="mod-edit-title">
                {mode === "create" ? t.modCreateTitle : t.modEditTitle}
              </h3>
              <p className="lead">
                {mode === "create" ? t.modCreateLede : t.modEditLede}
              </p>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="mcode">{t.modCode}</label>
                  <input
                    id="mcode"
                    value={draft.moduleCode}
                    onChange={(e) => patchDraft("moduleCode", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="mfac">{t.modFaculty}</label>
                  <input
                    id="mfac"
                    value={draft.faculty}
                    onChange={(e) => patchDraft("faculty", e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="meng">{t.modEngDesc}</label>
                <input
                  id="meng"
                  value={draft.moduleEngDesc}
                  onChange={(e) => patchDraft("moduleEngDesc", e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="mmly">{t.modMalayDesc}</label>
                <input
                  id="mmly"
                  value={draft.moduleMalayDesc}
                  onChange={(e) => patchDraft("moduleMalayDesc", e.target.value)}
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="mlevel">{t.modLevel}</label>
                  <input
                    id="mlevel"
                    value={draft.moduleLevel}
                    onChange={(e) => patchDraft("moduleLevel", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="mtype">{t.modType}</label>
                  <input
                    id="mtype"
                    value={draft.moduleType}
                    onChange={(e) => patchDraft("moduleType", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="mdept">{t.modDept}</label>
                  <input
                    id="mdept"
                    value={draft.moduleDeptCode}
                    onChange={(e) =>
                      patchDraft("moduleDeptCode", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="mcredit">{t.modCredit}</label>
                  <input
                    id="mcredit"
                    type="number"
                    min={0}
                    value={draft.credit}
                    onChange={(e) =>
                      patchDraft("credit", Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="minuse">{t.modInUse}</label>
                  <select
                    id="minuse"
                    value={draft.inUse ? "Y" : "N"}
                    onChange={(e) =>
                      patchDraft("inUse", e.target.value === "Y")
                    }
                  >
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="mactive">{t.modActive}</label>
                  <select
                    id="mactive"
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
                  {mode === "create" ? t.modCreate : t.modSave}
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
        <h2>{t.modTitle}</h2>
        <p className="lead">{t.modLede}</p>

        {!paramListsReady ? (
          <p className="lead">{t.paramLoading}</p>
        ) : (
          <>
            <div className="toolbar">
              <div className="field" style={{ minWidth: 220 }}>
                <label htmlFor="mq">{t.modSearch}</label>
                <input
                  id="mq"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.modSearchPh}
                />
              </div>
              <div className="field">
                <label htmlFor="mfacf">{t.modFaculty}</label>
                <select
                  id="mfacf"
                  value={facultyFilter}
                  onChange={(e) => setFacultyFilter(e.target.value)}
                >
                  <option value="all">{t.modAllFaculties}</option>
                  {faculties.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="mactf">{t.modActive}</label>
                <select
                  id="mactf"
                  value={activeOnly ? "Y" : "all"}
                  onChange={(e) => setActiveOnly(e.target.value === "Y")}
                >
                  <option value="Y">{t.modActiveOnly}</option>
                  <option value="all">{t.modShowAll}</option>
                </select>
              </div>
              <button type="button" className="btn btn-sm" onClick={openCreate}>
                {t.modAdd}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void reloadSeed()}
              >
                {t.modReloadSeed}
              </button>
            </div>

            <p className="lead" style={{ marginBottom: "0.75rem" }}>
              {t.modCount
                .replace("{shown}", String(visible.length))
                .replace("{total}", String(modules.length))}
            </p>

            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.modCode}</th>
                    <th>{t.modEngDesc}</th>
                    <th>{t.modFaculty}</th>
                    <th>{t.modCredit}</th>
                    <th>{t.modLevel}</th>
                    <th>{t.modType}</th>
                    <th>{t.modInUse}</th>
                    <th>{t.modActive}</th>
                    <th>{t.usersActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.moduleCode}</strong>
                      </td>
                      <td>{row.moduleEngDesc}</td>
                      <td>{row.faculty || "—"}</td>
                      <td>{row.credit}</td>
                      <td>{row.moduleLevel}</td>
                      <td>{row.moduleType}</td>
                      <td>
                        <span
                          className={`badge ${row.inUse ? "badge-ok" : "badge-off"}`}
                        >
                          {row.inUse ? "Y" : "N"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${row.active ? "badge-ok" : "badge-off"}`}
                        >
                          {row.active ? "Y" : "N"}
                        </span>
                      </td>
                      <td>
                        <div className="chip-row">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEdit(row)}
                          >
                            {t.modEdit}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setDeleteId(row.id)}
                          >
                            {t.modDelete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="toolbar" style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t.paramPrev}
              </button>
              <span className="lead" style={{ margin: 0 }}>
                {t.paramPage
                  .replace("{page}", String(safePage))
                  .replace("{pages}", String(pageCount))}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                {t.paramNext}
              </button>
            </div>
          </>
        )}
      </div>

      {editor}

      <ConfirmDialog
        open={Boolean(deleteId && deleting)}
        title={t.modDeleteTitle}
        body={t.modDeleteBody.replace("{code}", deleting?.moduleCode ?? "")}
        confirmLabel={t.modDelete}
        cancelLabel={t.sysCancel}
        danger
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
