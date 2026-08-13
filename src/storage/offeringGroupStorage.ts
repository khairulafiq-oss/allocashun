import type { OfferingGroup } from "../types";
import {
  applyOverlay,
  overlayFromDiff,
  readOverlay,
  writeOverlay,
} from "./overlayListStorage";

const OVERLAY_KEY = "um-tt-offering-groups-overlay-v1";
const SEED_URL = "/data/offeringGroups.seed.json";

let seedCache: OfferingGroup[] | null = null;

async function getSeed(): Promise<OfferingGroup[]> {
  if (seedCache) return seedCache;
  const res = await fetch(SEED_URL);
  if (!res.ok) throw new Error(`Failed to load offering groups seed (${res.status})`);
  const parsed: unknown = await res.json();
  if (!Array.isArray(parsed)) throw new Error("Invalid offering groups seed");
  seedCache = parsed as OfferingGroup[];
  return seedCache;
}

export async function loadOfferingGroups(): Promise<OfferingGroup[]> {
  const seed = await getSeed();
  return applyOverlay(seed, readOverlay<OfferingGroup>(OVERLAY_KEY));
}

export async function saveOfferingGroups(
  offeringGroups: OfferingGroup[],
): Promise<void> {
  const seed = await getSeed();
  writeOverlay(OVERLAY_KEY, overlayFromDiff(seed, offeringGroups));
}

export async function resetOfferingGroupsToSeed(): Promise<OfferingGroup[]> {
  localStorage.removeItem(OVERLAY_KEY);
  seedCache = null;
  return structuredClone(await getSeed());
}
