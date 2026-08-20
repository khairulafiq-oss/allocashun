import cors from "cors";
import express from "express";
import { ensureDefaultAdmin } from "./auth.js";
import { pool } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { documentsRouter } from "./routes/documents.js";
import { runsRouter } from "./routes/runs.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: "15mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "allocashun-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/schedule-runs", runsRouter);

async function main() {
  // Wait for DB (compose healthcheck helps; retry for safety)
  for (let i = 0; i < 30; i++) {
    try {
      await pool.query("SELECT 1");
      break;
    } catch (err) {
      console.warn(`[api] Waiting for database… (${i + 1}/30)`);
      await new Promise((r) => setTimeout(r, 2000));
      if (i === 29) throw err;
    }
  }

  await ensureDefaultAdmin();
  app.listen(port, "0.0.0.0", () => {
    console.log(`[api] Listening on :${port}`);
  });
}

main().catch((err) => {
  console.error("[api] Failed to start", err);
  process.exit(1);
});
