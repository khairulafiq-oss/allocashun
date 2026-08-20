import { Router, type Request } from "express";
import { requireAuth, type AuthUser } from "../auth.js";
import { query } from "../db.js";

export const runsRouter = Router();

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** List recent runs for a scope. */
runsRouter.get("/", requireAuth, async (req, res) => {
  const academicYear = String(req.query.academicYear ?? "").trim();
  const periodSlot = String(req.query.periodSlot ?? "").trim();
  const facultyCode = String(req.query.facultyCode ?? "").trim();
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const result = await query(
    `SELECT id, academic_year, period_slot, faculty_code, constraint_id,
            status, created_by, ready_count, skip_count, error_count, created_at
     FROM schedule_runs
     WHERE ($1 = '' OR academic_year = $1)
       AND ($2 = '' OR period_slot = $2)
       AND ($3 = '' OR faculty_code = $3)
     ORDER BY created_at DESC
     LIMIT $4`,
    [academicYear, periodSlot, facultyCode, limit],
  );
  res.json({ runs: result.rows });
});

runsRouter.get("/:id", requireAuth, async (req, res) => {
  const result = await query("SELECT * FROM schedule_runs WHERE id = $1", [
    req.params.id,
  ]);
  if (!result.rows[0]) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  res.json({ run: result.rows[0] });
});

/**
 * Persist a generate/apply result (run history).
 * Optionally merge created entries into the shared schedule document.
 */
runsRouter.post("/", requireAuth, async (req, res) => {
  const body = req.body ?? {};
  const academicYear = String(body.academicYear ?? "").trim();
  const periodSlot = String(body.periodSlot ?? "").trim();
  if (!academicYear || !periodSlot) {
    res.status(400).json({ error: "academicYear and periodSlot required" });
    return;
  }

  const user = (req as Request & { user?: AuthUser }).user;
  const id = newId("run");
  const plan = body.plan ?? [];
  const createdEntries = Array.isArray(body.createdEntries)
    ? body.createdEntries
    : [];
  const mergeIntoSchedule = body.mergeIntoSchedule !== false;

  await query(
    `INSERT INTO schedule_runs (
       id, academic_year, period_slot, faculty_code, constraint_id, status,
       created_by, ready_count, skip_count, error_count, plan, created_entries
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)`,
    [
      id,
      academicYear,
      periodSlot,
      String(body.facultyCode ?? ""),
      body.constraintId ?? null,
      String(body.status ?? "applied"),
      user?.email ?? null,
      Number(body.readyCount) || 0,
      Number(body.skipCount) || 0,
      Number(body.errorCount) || 0,
      JSON.stringify(plan),
      JSON.stringify(createdEntries),
    ],
  );

  if (mergeIntoSchedule && createdEntries.length > 0) {
    const doc = await query<{ payload: unknown }>(
      "SELECT payload FROM app_documents WHERE key = 'schedule'",
    );
    const existing = Array.isArray(doc.rows[0]?.payload)
      ? (doc.rows[0].payload as unknown[])
      : [];
    const merged = [...existing, ...createdEntries];
    await query(
      `UPDATE app_documents
       SET payload = $1::jsonb, updated_at = NOW(), updated_by = $2
       WHERE key = 'schedule'`,
      [JSON.stringify(merged), user?.email ?? null],
    );
  }

  res.status(201).json({ id, ok: true, merged: mergeIntoSchedule });
});
