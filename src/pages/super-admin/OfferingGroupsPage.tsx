import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FlashBanner } from "../../components/FlashBanner";
import { useLanguage } from "../../i18n/LanguageContext";
import { useStore } from "../../state/StoreContext";
import { resetOfferingGroupsToSeed } from "../../storage/offeringGroupStorage";
import type { OfferingGroup } from "../../types";

type OfferingDraft = Omit<OfferingGroup, "id">;
type EditorMode = "create" | "edit" | null;

const PAGE_SIZE = 50;

function emptyDraft(): OfferingDraft {
  return {
    modOffCode: "",
    moduleCode: "",
    moduleName: "",
    occurrence: "1",
    academicYear: "2026",
    periodSlot: "S1",
    facultyCode: "",
    facultyName: "",
    location: "UMKL",
    scheme: "UM",
    level: 3,
    targetNoStudents: 0,
    actualNoStudents: 0,
    coordinatorId: "",
    creditValue: 3,
    holidayCode: "KL",
    related: "",
    active: true,
    isAbstract: false,
  };
}

function toDraft(row: OfferingGroup): OfferingDraft {
  return {
    modOffCode: row.modOffCode ?? "",
    moduleCode: row.moduleCode ?? "",
    moduleName: row.moduleName ?? "",
    occurrence: row.occurrence ?? "",
    academicYear: row.academicYear ?? "",
    periodSlot: row.periodSlot ?? "",
    facultyCode: row.facultyCode ?? "",
    facultyName: row.facultyName ?? "",
    location: row.location ?? "",
    scheme: row.scheme ?? "",
    level: Number(row.level) || 0,
    targetNoStudents: Number(row.targetNoStudents) || 0,
    actualNoStudents: Number(row.actualNoStudents) || 0,
    coordinatorId: row.coordinatorId ?? "",
    creditValue: Number(row.creditValue) || 0,
    holidayCode: row.holidayCode ?? "",
    related: row.related ?? "",
    active: Boolean(row.active),
    isAbstract: Boolean(row.isAbstract),
  };
}

function normalizeDraft(draft: OfferingDraft): OfferingDraft {
  return {
    ...draft,
    modOffCode: draft.modOffCode.trim().toUpperCase(),
    moduleCode: draft.moduleCode.trim().toUpperCase(),
    moduleName: draft.moduleName.trim().toUpperCase(),
    occurrence: draft.occurrence.trim(),
    academicYear: draft.academicYear.trim(),
    periodSlot: draft.periodSlot.trim().toUpperCase(),
    facultyCode: draft.facultyCode.trim().toUpperCase(),
    facultyName: draft.facultyName.trim().toUpperCase(),
    location: draft.location.trim().toUpperCase(),
    scheme: draft.scheme.trim().toUpperCase(),
    coordinatorId: draft.coordinatorId.trim(),
    holidayCode: draft.holidayCode.trim().toUpperCase(),
    related: draft.related.trim(),
    level: Number(draft.level) || 0,
    targetNoStudents: Number(draft.targetNoStudents) || 0,
    actualNoStudents: Number(draft.actualNoStudents) || 0,
    creditValue: Number(draft.creditValue) || 0,
    active: Boolean(draft.active),
    isAbstract: Boolean(draft.isAbstract),
  };
}

function draftsEqual(a: OfferingDraft, b: OfferingDraft): boolean {
  return JSON.stringify(normalizeDraft(a)) === JSON.stringify(normalizeDraft(b));
}

export function OfferingGroupsPage() {
  const { t } = useLanguage();
  const {
    offeringGroups,
    setOfferingGroups,
    paramListsReady,
    pushAudit,
    setFlash,
  } = useStore();
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [facultyFilter, setFacultyFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<EditorMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<OfferingDraft | null>(null);
  const [baseline, setBaseline] = useState<OfferingDraft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const faculties = useMemo(
    () =>
      Array.from(
        new Set(offeringGroups.map((row) => row.facultyCode).filter(Boolean)),
      ).sort(),
    [offeringGroups],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return offeringGroups
      .filter((row) => {
        if (activeOnly && !row.active) return false;
        if (facultyFilter !== "all" && row.facultyCode !== facultyFilter)
          return false;
        if (!q) return true;
        const hay = [
          row.modOffCode,
          row.moduleCode,
          row.moduleName,
          row.occurrence,
          row.facultyCode,
          row.facultyName,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) =>
        a.modOffCode.localeCompare(b.modOffCode, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [offeringGroups, activeOnly, facultyFilter, query]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = visible.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [query, activeOnly, facultyFilter]);

  const deleting = offeringGroups.find((row) => row.id === deleteId) ?? null;
  const isDirty =
    Boolean(mode && draft && baseline) &&
    !draftsEqual(draft as OfferingDraft, baseline as OfferingDraft);

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
    const next = await resetOfferingGroupsToSeed();
    setOfferingGroups(next);
    pushAudit(
      "OFFERING_RELOAD",
      `Reloaded ${next.length} offering groups from seed`,
    );
    setFlash({
      kind: "ok",
      message: t.offReloaded.replace("{n}", String(next.length)),
    });
  }

  function openCreate() {
    const next = emptyDraft();
    setMode("create");
    setEditingId(null);
    setDraft(next);
    setBaseline(next);
  }

  function openEdit(row: OfferingGroup) {
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
    if (!next.modOffCode || !next.moduleCode) {
      setFlash({ kind: "bad", message: t.offEditIncomplete });
      return;
    }

    const duplicate = offeringGroups.some(
      (row) =>
        row.modOffCode.toUpperCase() === next.modOffCode &&
        row.id !== editingId,
    );
    if (duplicate) {
      setFlash({ kind: "bad", message: t.offDuplicate });
      return;
    }

    if (mode === "create") {
      const created: OfferingGroup = {
        id: `off-${next.modOffCode}-${Date.now()}`,
        ...next,
      };
      setOfferingGroups((prev) => [created, ...prev]);
      pushAudit("OFFERING_CREATE", `Created offering ${created.modOffCode}`);
      setFlash({ kind: "ok", message: t.offCreated });
    } else if (mode === "edit" && editingId) {
      setOfferingGroups((prev) =>
        prev.map((row) => (row.id === editingId ? { ...row, ...next } : row)),
      );
      pushAudit("OFFERING_UPDATE", `Updated offering ${next.modOffCode}`);
      setFlash({ kind: "ok", message: t.offUpdated });
    }
    closeEditor();
  }

  function confirmDelete() {
    if (!deleting) return;
    setOfferingGroups((prev) => prev.filter((row) => row.id !== deleting.id));
    pushAudit("OFFERING_DELETE", `Deleted offering ${deleting.modOffCode}`);
    setFlash({ kind: "ok", message: t.offDeleted });
    setDeleteId(null);
  }

  function patchDraft<K extends keyof OfferingDraft>(
    key: K,
    value: OfferingDraft[K],
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
              aria-labelledby="off-edit-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="off-edit-title">
                {mode === "create" ? t.offCreateTitle : t.offEditTitle}
              </h3>
              <p className="lead">
                {mode === "create" ? t.offCreateLede : t.offEditLede}
              </p>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="omod">{t.offModOffCode}</label>
                  <input
                    id="omod"
                    value={draft.modOffCode}
                    onChange={(e) => patchDraft("modOffCode", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ocode">{t.offModuleCode}</label>
                  <input
                    id="ocode"
                    value={draft.moduleCode}
                    onChange={(e) => patchDraft("moduleCode", e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="oname">{t.offModuleName}</label>
                <input
                  id="oname"
                  value={draft.moduleName}
                  onChange={(e) => patchDraft("moduleName", e.target.value)}
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="oocc">{t.offOccurrence}</label>
                  <input
                    id="oocc"
                    value={draft.occurrence}
                    onChange={(e) => patchDraft("occurrence", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="oyear">{t.offAcademicYear}</label>
                  <input
                    id="oyear"
                    value={draft.academicYear}
                    onChange={(e) => patchDraft("academicYear", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="operiod">{t.offPeriodSlot}</label>
                  <input
                    id="operiod"
                    value={draft.periodSlot}
                    onChange={(e) => patchDraft("periodSlot", e.target.value)}
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="ofac">{t.offFacultyCode}</label>
                  <input
                    id="ofac"
                    value={draft.facultyCode}
                    onChange={(e) => patchDraft("facultyCode", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ofacn">{t.offFacultyName}</label>
                  <input
                    id="ofacn"
                    value={draft.facultyName}
                    onChange={(e) => patchDraft("facultyName", e.target.value)}
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="otarget">{t.offTarget}</label>
                  <input
                    id="otarget"
                    type="number"
                    min={0}
                    value={draft.targetNoStudents}
                    onChange={(e) =>
                      patchDraft(
                        "targetNoStudents",
                        Number(e.target.value) || 0,
                      )
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="ocredit">{t.offCredit}</label>
                  <input
                    id="ocredit"
                    type="number"
                    min={0}
                    value={draft.creditValue}
                    onChange={(e) =>
                      patchDraft("creditValue", Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="oactive">{t.offActive}</label>
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

              <div className="field-row">
                <div className="field">
                  <label htmlFor="oloc">{t.offLocation}</label>
                  <input
                    id="oloc"
                    value={draft.location}
                    onChange={(e) => patchDraft("location", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ocoord">{t.offCoordinator}</label>
                  <input
                    id="ocoord"
                    value={draft.coordinatorId}
                    onChange={(e) =>
                      patchDraft("coordinatorId", e.target.value)
                    }
                  />
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
                  {mode === "create" ? t.offCreate : t.offSave}
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
        <h2>{t.offTitle}</h2>
        <p className="lead">{t.offLede}</p>

        {!paramListsReady ? (
          <p className="lead">{t.paramLoading}</p>
        ) : (
          <>
            <div className="toolbar">
              <div className="field" style={{ minWidth: 220 }}>
                <label htmlFor="oq">{t.offSearch}</label>
                <input
                  id="oq"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.offSearchPh}
                />
              </div>
              <div className="field">
                <label htmlFor="ofacf">{t.offFacultyCode}</label>
                <select
                  id="ofacf"
                  value={facultyFilter}
                  onChange={(e) => setFacultyFilter(e.target.value)}
                >
                  <option value="all">{t.offAllFaculties}</option>
                  {faculties.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="oactf">{t.offActive}</label>
                <select
                  id="oactf"
                  value={activeOnly ? "Y" : "all"}
                  onChange={(e) => setActiveOnly(e.target.value === "Y")}
                >
                  <option value="Y">{t.offActiveOnly}</option>
                  <option value="all">{t.offShowAll}</option>
                </select>
              </div>
              <button type="button" className="btn btn-sm" onClick={openCreate}>
                {t.offAdd}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void reloadSeed()}
              >
                {t.offReloadSeed}
              </button>
            </div>

            <p className="lead" style={{ marginBottom: "0.75rem" }}>
              {t.offCount
                .replace("{shown}", String(visible.length))
                .replace("{total}", String(offeringGroups.length))}
            </p>

            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.offModOffCode}</th>
                    <th>{t.offModuleCode}</th>
                    <th>{t.offModuleName}</th>
                    <th>{t.offOccurrence}</th>
                    <th>{t.offAcademicYear}</th>
                    <th>{t.offPeriodSlot}</th>
                    <th>{t.offFacultyCode}</th>
                    <th>{t.offTarget}</th>
                    <th>{t.offActive}</th>
                    <th>{t.usersActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.modOffCode}</strong>
                      </td>
                      <td>{row.moduleCode}</td>
                      <td>{row.moduleName}</td>
                      <td>{row.occurrence}</td>
                      <td>{row.academicYear}</td>
                      <td>{row.periodSlot}</td>
                      <td>{row.facultyCode}</td>
                      <td>{row.targetNoStudents}</td>
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
                            {t.offEdit}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setDeleteId(row.id)}
                          >
                            {t.offDelete}
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
        title={t.offDeleteTitle}
        body={t.offDeleteBody.replace("{code}", deleting?.modOffCode ?? "")}
        confirmLabel={t.offDelete}
        cancelLabel={t.sysCancel}
        danger
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
