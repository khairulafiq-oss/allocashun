/**
 * Cloud API client for ALLOCASHUN on Linux Docker.
 * When the app is served behind nginx, use relative `/api`.
 * Local Vite: set VITE_API_URL=http://localhost:3000 (optional).
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(
  /\/$/,
  "",
) ?? "";

const TOKEN_KEY = "um-tt-api-token";

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  facultyCode: string | null;
};

export function getApiToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setApiToken(token: string | null): void {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function isApiMode(): boolean {
  // Docker/nginx: always try /api. Local without VITE_API_URL stays localStorage-only
  // unless VITE_USE_API=true.
  if (import.meta.env.VITE_USE_API === "true") return true;
  if (API_BASE) return true;
  // Production build served from nginx proxies /api
  return import.meta.env.PROD === true;
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getApiToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

export async function apiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiLogin(
  email: string,
  password: string,
): Promise<{ token: string; user: ApiUser }> {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Login failed");
  }
  return res.json() as Promise<{ token: string; user: ApiUser }>;
}

export async function apiLoadDocument<T>(key: string): Promise<T | null> {
  const res = await apiFetch(`/api/documents/${encodeURIComponent(key)}`);
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) return null;
  const data = (await res.json()) as { payload: T };
  return data.payload;
}

export async function apiSaveDocument(
  key: string,
  payload: unknown,
): Promise<void> {
  const res = await apiFetch(`/api/documents/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Failed to save ${key}`);
  }
}

export async function apiCreateScheduleRun(body: {
  academicYear: string;
  periodSlot: string;
  facultyCode?: string;
  constraintId?: string;
  status?: string;
  readyCount?: number;
  skipCount?: number;
  errorCount?: number;
  plan?: unknown;
  createdEntries?: unknown[];
  mergeIntoSchedule?: boolean;
}): Promise<{ id: string }> {
  const res = await apiFetch("/api/schedule-runs", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Failed to save schedule run");
  }
  return res.json() as Promise<{ id: string }>;
}
