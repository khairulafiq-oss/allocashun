export type ListOverlay<T extends { id: string }> = {
  upserts: Record<string, T>;
  deletes: string[];
};

export function emptyOverlay<T extends { id: string }>(): ListOverlay<T> {
  return { upserts: {}, deletes: [] };
}

export function applyOverlay<T extends { id: string }>(
  seed: T[],
  overlay: ListOverlay<T>,
): T[] {
  const deleted = new Set(overlay.deletes);
  const seedIds = new Set(seed.map((row) => row.id));
  const result: T[] = [];

  for (const row of seed) {
    if (deleted.has(row.id)) continue;
    result.push(overlay.upserts[row.id] ?? row);
  }

  for (const [id, row] of Object.entries(overlay.upserts)) {
    if (seedIds.has(id) || deleted.has(id)) continue;
    result.unshift(row);
  }

  return result;
}

export function overlayFromDiff<T extends { id: string }>(
  seed: T[],
  current: T[],
): ListOverlay<T> {
  const seedMap = new Map(seed.map((row) => [row.id, row]));
  const currentIds = new Set(current.map((row) => row.id));
  const deletes: string[] = [];

  for (const id of seedMap.keys()) {
    if (!currentIds.has(id)) deletes.push(id);
  }

  const upserts: Record<string, T> = {};
  for (const row of current) {
    const base = seedMap.get(row.id);
    if (!base || JSON.stringify(base) !== JSON.stringify(row)) {
      upserts[row.id] = row;
    }
  }

  return { upserts, deletes };
}

export function readOverlay<T extends { id: string }>(
  key: string,
): ListOverlay<T> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return emptyOverlay();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyOverlay();
    const row = parsed as Partial<ListOverlay<T>>;
    return {
      upserts:
        row.upserts && typeof row.upserts === "object" ? row.upserts : {},
      deletes: Array.isArray(row.deletes)
        ? row.deletes.filter((id): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return emptyOverlay();
  }
}

export function writeOverlay<T extends { id: string }>(
  key: string,
  overlay: ListOverlay<T>,
): void {
  const empty =
    overlay.deletes.length === 0 && Object.keys(overlay.upserts).length === 0;
  if (empty) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(overlay));
}
