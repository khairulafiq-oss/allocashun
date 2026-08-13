import { roomsSeed } from "../data/rooms.seed";
import type { Room } from "../types";

const STORAGE_KEY = "um-tt-rooms-v2";

function isRoom(value: unknown): value is Room {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.roomCode === "string" &&
    typeof row.shortName === "string" &&
    typeof row.fullName === "string" &&
    typeof row.buildingCode === "string" &&
    typeof row.siteCode === "string" &&
    typeof row.roomTypeCode === "string" &&
    typeof row.roomTypeName === "string" &&
    typeof row.maximumSeats === "number" &&
    typeof row.inUse === "boolean"
  );
}

export function loadRooms(): Room[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveRooms(roomsSeed);
      return structuredClone(roomsSeed);
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isRoom)) {
      saveRooms(roomsSeed);
      return structuredClone(roomsSeed);
    }
    return parsed;
  } catch {
    saveRooms(roomsSeed);
    return structuredClone(roomsSeed);
  }
}

export function saveRooms(rooms: Room[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
}

export function resetRoomsToSeed(): Room[] {
  const next = structuredClone(roomsSeed);
  saveRooms(next);
  return next;
}
