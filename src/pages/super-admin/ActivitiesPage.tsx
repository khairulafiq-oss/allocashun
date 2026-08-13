import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FlashBanner } from "../../components/FlashBanner";
import { useLanguage } from "../../i18n/LanguageContext";
import { useStore } from "../../state/StoreContext";
import { resetActivitiesToSeed } from "../../storage/activityStorage";
import type { Activity } from "../../types";

type ActivityDraft = Omit<Activity, "id">;
type EditorMode = "create" | "edit" | null;

function emptyDraft(): ActivityDraft {
  return {
    activityCode: "",
    activityName: "",
    inUse: true,
    isAbstract: false,
  };
}

function toDraft(row: Activity): ActivityDraft {
  return {
    activityCode: row.activityCode ?? "",
    activityName: row.activityName ?? "",
    inUse: Boolean(row.inUse),
    isAbstract: Boolean(row.isAbstract),
  };
}

function normalizeDraft(draft: ActivityDraft): ActivityDraft {
  return {
    activityCode: draft.activityCode.trim().toUpperCase(),
    activityName: draft.activityName.trim().toUpperCase(),
    inUse: Boolean(draft.inUse),
    isAbstract: Boolean(draft.isAbstract),
  };
}

function draftsEqual(a: ActivityDraft, b: ActivityDraft): boolean {
  return JSON.stringify(normalizeDraft(a)) === JSON.stringify(normalizeDraft(b));
}

export function ActivitiesPage() {
  const { t } = useLanguage();
  const { activities, setActivities, pushAudit, setFlash } = useStore();
  const [query, setQuery] = useState("");
  const [inUseOnly, setInUseOnly] = useState(false);
  const [mode, setMode] = useState<EditorMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ActivityDraft | null>(null);
  const [baseline, setBaseline] = useState<ActivityDraft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activities
      .filter((row) => {
        if (inUseOnly && !row.inUse) return false;
        if (!q) return true;
        const hay = [row.activityCode, row.activityName].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) =>
        a.activityCode.localeCompare(b.activityCode, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [activities, inUseOnly, query]);

  const deleting = activities.find((row) => row.id === deleteId) ?? null;
  const isDirty =
    Boolean(mode && draft && baseline) &&
    !draftsEqual(draft as ActivityDraft, baseline as ActivityDraft);

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
    const next = resetActivitiesToSeed();
    setActivities(next);
    pushAudit("ACTIVITY_RELOAD", `Reloaded ${next.length} activities from seed`);
    setFlash({
      kind: "ok",
      message: t.actReloaded.replace("{n}", String(next.length)),
    });
  }

  function openCreate() {
    const next = emptyDraft();
    setMode("create");
    setEditingId(null);
    setDraft(next);
    setBaseline(next);
  }

  function openEdit(row: Activity) {
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
    if (!next.activityCode || !next.activityName) {
      setFlash({ kind: "bad", message: t.actEditIncomplete });
      return;
    }

    const duplicate = activities.some(
      (row) =>
        row.activityCode.toUpperCase() === next.activityCode &&
        row.id !== editingId,
    );
    if (duplicate) {
      setFlash({ kind: "bad", message: t.actDuplicate });
      return;
    }

    if (mode === "create") {
      const created: Activity = {
        id: `act-${next.activityCode}-${Date.now()}`,
        ...next,
      };
      setActivities((prev) => [created, ...prev]);
      pushAudit("ACTIVITY_CREATE", `Created activity ${created.activityCode}`);
      setFlash({ kind: "ok", message: t.actCreated });
    } else if (mode === "edit" && editingId) {
      setActivities((prev) =>
        prev.map((row) => (row.id === editingId ? { ...row, ...next } : row)),
      );
      pushAudit("ACTIVITY_UPDATE", `Updated activity ${next.activityCode}`);
      setFlash({ kind: "ok", message: t.actUpdated });
    }
    closeEditor();
  }

  function confirmDelete() {
    if (!deleting) return;
    setActivities((prev) => prev.filter((row) => row.id !== deleting.id));
    pushAudit("ACTIVITY_DELETE", `Deleted activity ${deleting.activityCode}`);
    setFlash({ kind: "ok", message: t.actDeleted });
    setDeleteId(null);
  }

  function patchDraft<K extends keyof ActivityDraft>(
    key: K,
    value: ActivityDraft[K],
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
              aria-labelledby="act-edit-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="act-edit-title">
                {mode === "create" ? t.actCreateTitle : t.actEditTitle}
              </h3>
              <p className="lead">
                {mode === "create" ? t.actCreateLede : t.actEditLede}
              </p>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="acode">{t.actCode}</label>
                  <input
                    id="acode"
                    value={draft.activityCode}
                    onChange={(e) => patchDraft("activityCode", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="aname">{t.actName}</label>
                  <input
                    id="aname"
                    value={draft.activityName}
                    onChange={(e) => patchDraft("activityName", e.target.value)}
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="ainuse">{t.actInUse}</label>
                  <select
                    id="ainuse"
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
                  <label htmlFor="aabs">{t.actAbstract}</label>
                  <select
                    id="aabs"
                    value={draft.isAbstract ? "Y" : "N"}
                    onChange={(e) =>
                      patchDraft("isAbstract", e.target.value === "Y")
                    }
                  >
                    <option value="N">N</option>
                    <option value="Y">Y</option>
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
                  {mode === "create" ? t.actCreate : t.actSave}
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
        <h2>{t.actTitle}</h2>
        <p className="lead">{t.actLede}</p>

        <div className="toolbar">
          <div className="field" style={{ minWidth: 200 }}>
            <label htmlFor="aq">{t.actSearch}</label>
            <input
              id="aq"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.actSearchPh}
            />
          </div>
          <div className="field">
            <label htmlFor="ainusef">{t.actInUse}</label>
            <select
              id="ainusef"
              value={inUseOnly ? "Y" : "all"}
              onChange={(e) => setInUseOnly(e.target.value === "Y")}
            >
              <option value="all">{t.actShowAll}</option>
              <option value="Y">{t.actInUseOnly}</option>
            </select>
          </div>
          <button type="button" className="btn btn-sm" onClick={openCreate}>
            {t.actAdd}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={reloadSeed}>
            {t.actReloadSeed}
          </button>
        </div>

        <p className="lead" style={{ marginBottom: "0.75rem" }}>
          {t.actCount
            .replace("{shown}", String(visible.length))
            .replace("{total}", String(activities.length))}
        </p>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t.actCode}</th>
                <th>{t.actName}</th>
                <th>{t.actInUse}</th>
                <th>{t.actAbstract}</th>
                <th>{t.usersActions}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.activityCode}</strong>
                  </td>
                  <td>{row.activityName}</td>
                  <td>
                    <span
                      className={`badge ${row.inUse ? "badge-ok" : "badge-off"}`}
                    >
                      {row.inUse ? "Y" : "N"}
                    </span>
                  </td>
                  <td>{row.isAbstract ? "Y" : "N"}</td>
                  <td>
                    <div className="chip-row">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEdit(row)}
                      >
                        {t.actEdit}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setDeleteId(row.id)}
                      >
                        {t.actDelete}
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
        title={t.actDeleteTitle}
        body={t.actDeleteBody.replace("{code}", deleting?.activityCode ?? "")}
        confirmLabel={t.actDelete}
        cancelLabel={t.sysCancel}
        danger
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
