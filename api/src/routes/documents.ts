import { Router, type Request } from "express";
import { requireAuth, type AuthUser } from "../auth.js";
import { query } from "../db.js";

const ALLOWED_KEYS = new Set([
  "calendars",
  "time_rules",
  "schedule",
  "cancelled_schedule",
  "faculties",
  "rooms",
  "activities",
]);

export const documentsRouter = Router();

documentsRouter.get("/:key", requireAuth, async (req, res) => {
  const key = String(req.params.key);
  if (!ALLOWED_KEYS.has(key)) {
    res.status(400).json({ error: "Unknown document key" });
    return;
  }
  const result = await query<{ payload: unknown; updated_at: string }>(
    "SELECT payload, updated_at FROM app_documents WHERE key = $1",
    [key],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    key,
    payload: result.rows[0].payload,
    updatedAt: result.rows[0].updated_at,
  });
});

documentsRouter.put("/:key", requireAuth, async (req, res) => {
  const key = String(req.params.key);
  if (!ALLOWED_KEYS.has(key)) {
    res.status(400).json({ error: "Unknown document key" });
    return;
  }
  if (req.body?.payload === undefined) {
    res.status(400).json({ error: "payload required" });
    return;
  }
  const user = (req as Request & { user?: AuthUser }).user;
  const result = await query<{ updated_at: string }>(
    `INSERT INTO app_documents (key, payload, updated_at, updated_by)
     VALUES ($1, $2::jsonb, NOW(), $3)
     ON CONFLICT (key) DO UPDATE
       SET payload = EXCLUDED.payload,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by
     RETURNING updated_at`,
    [key, JSON.stringify(req.body.payload), user?.email ?? null],
  );
  res.json({
    key,
    ok: true,
    updatedAt: result.rows[0]?.updated_at,
  });
});
