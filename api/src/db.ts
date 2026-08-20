import pg from "pg";

const { Pool } = pg;

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgres://allocashun:changeme@localhost:5432/allocashun";

export const pool = new Pool({ connectionString: databaseUrl });

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  return pool.query<T>(text, params);
}
