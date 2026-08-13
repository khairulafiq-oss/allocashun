import type { Module } from "../types";
import {
  applyOverlay,
  overlayFromDiff,
  readOverlay,
  writeOverlay,
} from "./overlayListStorage";

const OVERLAY_KEY = "um-tt-modules-overlay-v1";
const SEED_URL = "/data/modules.seed.json";

let seedCache: Module[] | null = null;

async function getSeed(): Promise<Module[]> {
  if (seedCache) return seedCache;
  const res = await fetch(SEED_URL);
  if (!res.ok) throw new Error(`Failed to load modules seed (${res.status})`);
  const parsed: unknown = await res.json();
  if (!Array.isArray(parsed)) throw new Error("Invalid modules seed");
  seedCache = parsed as Module[];
  return seedCache;
}

export async function loadModules(): Promise<Module[]> {
  const seed = await getSeed();
  return applyOverlay(seed, readOverlay<Module>(OVERLAY_KEY));
}

export async function saveModules(modules: Module[]): Promise<void> {
  const seed = await getSeed();
  writeOverlay(OVERLAY_KEY, overlayFromDiff(seed, modules));
}

export async function resetModulesToSeed(): Promise<Module[]> {
  localStorage.removeItem(OVERLAY_KEY);
  seedCache = null;
  return structuredClone(await getSeed());
}
