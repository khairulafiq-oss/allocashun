# ALLOCASHUN — PostgreSQL init (runs once on empty volume)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'faculty_user',
  faculty_code  TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_documents (
  key         TEXT PRIMARY KEY,
  payload     JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  TEXT
);

CREATE TABLE IF NOT EXISTS schedule_runs (
  id              TEXT PRIMARY KEY,
  academic_year   TEXT NOT NULL,
  period_slot     TEXT NOT NULL,
  faculty_code    TEXT NOT NULL DEFAULT '',
  constraint_id   TEXT,
  status          TEXT NOT NULL DEFAULT 'applied',
  created_by      TEXT,
  ready_count     INT NOT NULL DEFAULT 0,
  skip_count      INT NOT NULL DEFAULT 0,
  error_count     INT NOT NULL DEFAULT 0,
  plan            JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_runs_scope
  ON schedule_runs (academic_year, period_slot, faculty_code, created_at DESC);

INSERT INTO app_documents (key, payload)
VALUES
  ('calendars', '[]'::jsonb),
  ('time_rules', '{}'::jsonb),
  ('schedule', '[]'::jsonb),
  ('cancelled_schedule', '[]'::jsonb),
  ('faculties', '[]'::jsonb),
  ('rooms', '[]'::jsonb),
  ('activities', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
