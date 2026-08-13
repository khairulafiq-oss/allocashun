import { activitiesSeed } from "../data/activities.seed";
import type { Activity } from "../types";

const STORAGE_KEY = "um-tt-activities-v1";

function isActivity(value: unknown): value is Activity {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.activityCode === "string" &&
    typeof row.activityName === "string" &&
    typeof row.inUse === "boolean" &&
    typeof row.isAbstract === "boolean"
  );
}

export function loadActivities(): Activity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveActivities(activitiesSeed);
      return structuredClone(activitiesSeed);
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      !parsed.every(isActivity)
    ) {
      saveActivities(activitiesSeed);
      return structuredClone(activitiesSeed);
    }
    return parsed;
  } catch {
    saveActivities(activitiesSeed);
    return structuredClone(activitiesSeed);
  }
}

export function saveActivities(activities: Activity[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
}

export function resetActivitiesToSeed(): Activity[] {
  const next = structuredClone(activitiesSeed);
  saveActivities(next);
  return next;
}
