# ALLOCASHUN

Timetable tooling for Universiti Malaya — Admin, MechaTable, and Calendar.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173

## Deploy on Linux (UM / Docker)

See **[DEPLOY-LINUX.md](./DEPLOY-LINUX.md)** for Docker Compose (web + API + PostgreSQL).

```bash
cp .env.example .env
docker compose build
docker compose up -d
```

## Publish for testers (Vercel demo)

See **[PUBLISH.md](./PUBLISH.md)** — static hosting without shared database.

## What’s included

- App launcher: Admin, MechaTable, Calendar
- Period & time rules, scheduling constraints (UG / PG / …)
- Manual compose + auto-generate from student package
- EN / BM language toggle
- Optional Docker stack: JWT login + shared Postgres documents
