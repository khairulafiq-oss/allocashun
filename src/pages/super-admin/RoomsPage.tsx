import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FlashBanner } from "../../components/FlashBanner";
import { useLanguage } from "../../i18n/LanguageContext";
import { useStore } from "../../state/StoreContext";
import { resetRoomsToSeed } from "../../storage/roomStorage";
import type { Room } from "../../types";

type RoomDraft = Omit<Room, "id">;
type EditorMode = "create" | "edit" | null;

function emptyDraft(): RoomDraft {
  return {
    roomCode: "",
    shortName: "",
    fullName: "",
    buildingCode: "",
    siteCode: "UM",
    roomTypeCode: "",
    roomTypeName: "",
    maximumSeats: 0,
    roomMaximumRows: 0,
    examCapacity: 0,
    feExamSystem: "",
    roomFormatCode: "LEC",
    locationCode: "",
    inUse: true,
    roomCollecDefForSite: "N",
    udf01: "",
    udf02: "",
    udf03: "",
    udf04: "",
    udf05: "",
    floor: "",
  };
}

function toDraft(room: Room): RoomDraft {
  return {
    roomCode: room.roomCode ?? "",
    shortName: room.shortName ?? "",
    fullName: room.fullName ?? "",
    buildingCode: room.buildingCode ?? "",
    siteCode: room.siteCode ?? "",
    roomTypeCode: room.roomTypeCode ?? "",
    roomTypeName: room.roomTypeName ?? "",
    maximumSeats: room.maximumSeats ?? 0,
    roomMaximumRows: room.roomMaximumRows ?? 0,
    examCapacity: room.examCapacity ?? 0,
    feExamSystem: room.feExamSystem ?? "",
    roomFormatCode: room.roomFormatCode ?? "",
    locationCode: room.locationCode ?? "",
    inUse: Boolean(room.inUse),
    roomCollecDefForSite: room.roomCollecDefForSite ?? "N",
    udf01: room.udf01 ?? "",
    udf02: room.udf02 ?? "",
    udf03: room.udf03 ?? "",
    udf04: room.udf04 ?? "",
    udf05: room.udf05 ?? "",
    floor: room.floor ?? "",
  };
}

function normalizeDraft(draft: RoomDraft): RoomDraft {
  return {
    ...draft,
    roomCode: draft.roomCode.trim(),
    shortName: draft.shortName.trim(),
    fullName: draft.fullName.trim(),
    buildingCode: draft.buildingCode.trim(),
    siteCode: draft.siteCode.trim(),
    roomTypeCode: draft.roomTypeCode.trim(),
    roomTypeName: draft.roomTypeName.trim(),
    locationCode: draft.locationCode.trim(),
    roomFormatCode: draft.roomFormatCode.trim(),
    floor: draft.floor.trim(),
    maximumSeats: Number(draft.maximumSeats) || 0,
    examCapacity: Number(draft.examCapacity) || 0,
    roomMaximumRows: Number(draft.roomMaximumRows) || 0,
  };
}

function draftsEqual(a: RoomDraft, b: RoomDraft): boolean {
  return JSON.stringify(normalizeDraft(a)) === JSON.stringify(normalizeDraft(b));
}

export function RoomsPage() {
  const { t } = useLanguage();
  const { rooms, setRooms, pushAudit, setFlash } = useStore();
  const [query, setQuery] = useState("");
  const [inUseOnly, setInUseOnly] = useState(true);
  const [siteFilter, setSiteFilter] = useState("all");
  const [mode, setMode] = useState<EditorMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoomDraft | null>(null);
  const [baseline, setBaseline] = useState<RoomDraft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const sites = useMemo(
    () =>
      Array.from(new Set(rooms.map((r) => r.siteCode).filter(Boolean))).sort(),
    [rooms],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rooms
      .filter((r) => {
        if (inUseOnly && !r.inUse) return false;
        if (siteFilter !== "all" && r.siteCode !== siteFilter) return false;
        if (!q) return true;
        const hay = [
          r.roomCode,
          r.shortName,
          r.fullName,
          r.buildingCode,
          r.roomTypeCode,
          r.roomTypeName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) =>
        a.roomCode.localeCompare(b.roomCode, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [rooms, query, inUseOnly, siteFilter]);

  const deletingRoom = rooms.find((r) => r.id === deleteId) ?? null;
  const isDirty =
    Boolean(mode && draft && baseline) &&
    !draftsEqual(draft as RoomDraft, baseline as RoomDraft);

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
    const next = resetRoomsToSeed();
    setRooms(next);
    pushAudit("ROOMS_RELOAD", `Reloaded ${next.length} rooms from Shun ROM seed`);
    setFlash({
      kind: "ok",
      message: t.roomsReloaded.replace("{n}", String(next.length)),
    });
  }

  function openCreate() {
    const next = emptyDraft();
    setMode("create");
    setEditingId(null);
    setDraft(next);
    setBaseline(next);
  }

  function openEdit(room: Room) {
    const next = toDraft(room);
    setMode("edit");
    setEditingId(room.id);
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
    if (!next.roomCode || !next.shortName) {
      setFlash({ kind: "bad", message: t.roomsEditIncomplete });
      return;
    }

    const duplicate = rooms.some(
      (r) =>
        r.roomCode.toLowerCase() === next.roomCode.toLowerCase() &&
        r.id !== editingId,
    );
    if (duplicate) {
      setFlash({ kind: "bad", message: t.roomsDuplicate });
      return;
    }

    if (mode === "create") {
      const created: Room = { id: `room-${Date.now()}`, ...next };
      setRooms((prev) => [created, ...prev]);
      pushAudit("ROOM_CREATE", `Created room ${created.roomCode}`);
      setFlash({ kind: "ok", message: t.roomsCreated });
    } else if (mode === "edit" && editingId) {
      setRooms((prev) =>
        prev.map((r) => (r.id === editingId ? { ...r, ...next } : r)),
      );
      pushAudit("ROOM_UPDATE", `Updated room ${next.roomCode}`);
      setFlash({ kind: "ok", message: t.roomsSaved });
    }
    closeEditor();
  }

  function confirmDelete() {
    if (!deletingRoom) return;
    setRooms((prev) => prev.filter((r) => r.id !== deletingRoom.id));
    pushAudit("ROOM_DELETE", `Deleted room ${deletingRoom.roomCode}`);
    setFlash({ kind: "ok", message: t.roomsDeleted });
    setDeleteId(null);
  }

  function patchDraft<K extends keyof RoomDraft>(key: K, value: RoomDraft[K]) {
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
              aria-labelledby="room-edit-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="room-edit-title">
                {mode === "create" ? t.roomsCreateTitle : t.roomsEditTitle}
              </h3>
              <p className="lead">
                {mode === "create" ? t.roomsCreateLede : t.roomsEditLede}
              </p>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="rc">{t.roomsCode}</label>
                  <input
                    id="rc"
                    value={draft.roomCode}
                    onChange={(e) => patchDraft("roomCode", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rs">{t.roomsShort}</label>
                  <input
                    id="rs"
                    value={draft.shortName}
                    onChange={(e) => patchDraft("shortName", e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="rf">{t.roomsFull}</label>
                <input
                  id="rf"
                  value={draft.fullName}
                  onChange={(e) => patchDraft("fullName", e.target.value)}
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="rb">{t.roomsBuilding}</label>
                  <input
                    id="rb"
                    value={draft.buildingCode}
                    onChange={(e) => patchDraft("buildingCode", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rsi">{t.roomsSite}</label>
                  <input
                    id="rsi"
                    value={draft.siteCode}
                    onChange={(e) => patchDraft("siteCode", e.target.value)}
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="rtc">{t.roomsType}</label>
                  <input
                    id="rtc"
                    value={draft.roomTypeCode}
                    onChange={(e) => patchDraft("roomTypeCode", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rtn">{t.roomsTypeName}</label>
                  <input
                    id="rtn"
                    value={draft.roomTypeName}
                    onChange={(e) => patchDraft("roomTypeName", e.target.value)}
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="rseats">{t.roomsSeats}</label>
                  <input
                    id="rseats"
                    type="number"
                    min={0}
                    value={draft.maximumSeats}
                    onChange={(e) =>
                      patchDraft("maximumSeats", Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="rexam">{t.roomsExamCap}</label>
                  <input
                    id="rexam"
                    type="number"
                    min={0}
                    value={draft.examCapacity}
                    onChange={(e) =>
                      patchDraft("examCapacity", Number(e.target.value) || 0)
                    }
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="rfloor">{t.roomsFloor}</label>
                  <input
                    id="rfloor"
                    value={draft.floor}
                    onChange={(e) => patchDraft("floor", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rloc">{t.roomsLocation}</label>
                  <input
                    id="rloc"
                    value={draft.locationCode}
                    onChange={(e) => patchDraft("locationCode", e.target.value)}
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="rfmt">{t.roomsFormat}</label>
                  <input
                    id="rfmt"
                    value={draft.roomFormatCode}
                    onChange={(e) =>
                      patchDraft("roomFormatCode", e.target.value)
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="rinuse">{t.roomsInUse}</label>
                  <select
                    id="rinuse"
                    value={draft.inUse ? "Y" : "N"}
                    onChange={(e) =>
                      patchDraft("inUse", e.target.value === "Y")
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
                  {mode === "create" ? t.roomsCreate : t.roomsSave}
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
        <h2>{t.roomsTitle}</h2>
        <p className="lead">{t.roomsLede}</p>

        <div className="toolbar">
          <div className="field" style={{ minWidth: 220 }}>
            <label htmlFor="rq">{t.roomsSearch}</label>
            <input
              id="rq"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.roomsSearchPh}
            />
          </div>
          <div className="field">
            <label htmlFor="site">{t.roomsSite}</label>
            <select
              id="site"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
            >
              <option value="all">{t.roomsAllSites}</option>
              {sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="inuse">{t.roomsInUse}</label>
            <select
              id="inuse"
              value={inUseOnly ? "Y" : "all"}
              onChange={(e) => setInUseOnly(e.target.value === "Y")}
            >
              <option value="Y">{t.roomsInUseOnly}</option>
              <option value="all">{t.roomsShowAll}</option>
            </select>
          </div>
          <button type="button" className="btn btn-sm" onClick={openCreate}>
            {t.roomsAdd}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={reloadSeed}>
            {t.roomsReloadSeed}
          </button>
        </div>

        <p className="lead" style={{ marginBottom: "0.75rem" }}>
          {t.roomsCount
            .replace("{shown}", String(visible.length))
            .replace("{total}", String(rooms.length))}
        </p>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t.roomsCode}</th>
                <th>{t.roomsShort}</th>
                <th>{t.roomsFull}</th>
                <th>{t.roomsBuilding}</th>
                <th>{t.roomsSite}</th>
                <th>{t.roomsType}</th>
                <th>{t.roomsTypeName}</th>
                <th>{t.roomsSeats}</th>
                <th>{t.roomsExamCap}</th>
                <th>{t.roomsFloor}</th>
                <th>{t.roomsInUse}</th>
                <th>{t.usersActions}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.roomCode}</strong>
                  </td>
                  <td>{r.shortName}</td>
                  <td>{r.fullName}</td>
                  <td>{r.buildingCode}</td>
                  <td>{r.siteCode}</td>
                  <td>{r.roomTypeCode}</td>
                  <td>{r.roomTypeName || "—"}</td>
                  <td>{r.maximumSeats}</td>
                  <td>{r.examCapacity}</td>
                  <td>{r.floor || "—"}</td>
                  <td>
                    <span className={`badge ${r.inUse ? "badge-ok" : "badge-off"}`}>
                      {r.inUse ? "Y" : "N"}
                    </span>
                  </td>
                  <td>
                    <div className="chip-row">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEdit(r)}
                      >
                        {t.roomsEdit}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setDeleteId(r.id)}
                      >
                        {t.roomsDelete}
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
        open={Boolean(deleteId && deletingRoom)}
        title={t.roomsDeleteTitle}
        body={t.roomsDeleteBody.replace(
          "{code}",
          deletingRoom?.roomCode ?? "",
        )}
        confirmLabel={t.roomsDelete}
        cancelLabel={t.sysCancel}
        danger
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
