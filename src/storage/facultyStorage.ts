import { facultiesSeed } from "../data/faculties.seed";
import type { Faculty } from "../types";

const STORAGE_KEY = "um-tt-faculties-v1";

function isFaculty(value: unknown): value is Faculty {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.facultyCode === "string" &&
    typeof row.shortName === "string" &&
    typeof row.fullName === "string" &&
    typeof row.active === "boolean" &&
    typeof row.fullNameBm === "string" &&
    typeof row.email === "string"
  );
}

export function loadFaculties(): Faculty[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveFaculties(facultiesSeed);
      return structuredClone(facultiesSeed);
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isFaculty)) {
      saveFaculties(facultiesSeed);
      return structuredClone(facultiesSeed);
    }
    return parsed;
  } catch {
    saveFaculties(facultiesSeed);
    return structuredClone(facultiesSeed);
  }
}

export function saveFaculties(faculties: Faculty[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(faculties));
}

export function resetFacultiesToSeed(): Faculty[] {
  const next = structuredClone(facultiesSeed);
  saveFaculties(next);
  return next;
}
