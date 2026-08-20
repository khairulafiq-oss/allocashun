# Deploy ALLOCASHUN on Linux (UM / any Ubuntu server)

Full stack with Docker Compose:

| Container | Role |
|-----------|------|
| **web** | React app (nginx) |
| **api** | Login + shared database API |
| **db** | PostgreSQL |

All testers share the same calendars, time rules, and schedule.

---

## 1. Prerequisites on the Linux server

- SSH access
- Docker + Compose plugin
- Ports **80** (and ideally **443**) open

### Install Docker (Ubuntu 22.04+)

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER
# log out and SSH in again
docker --version
docker compose version
```

---

## 2. Clone the project

```bash
cd ~
git clone https://github.com/khairulafiq-oss/allocashun.git
cd allocashun
```

If the repo is already on the machine, `cd` into that folder instead.

---

## 3. Environment file

```bash
cp .env.example .env
nano .env
```

Set strong values:

```
DB_PASSWORD=your-strong-db-password
JWT_SECRET=your-long-random-jwt-secret
HOST_PORT=80
```

Do **not** commit `.env` to Git.

---

## 4. Build and start

```bash
docker compose build
docker compose up -d
docker compose ps
```

Check logs:

```bash
docker compose logs -f api
docker compose logs -f web
```

Open in browser:

```
http://SERVER_IP/
```

---

## 5. First login

1. App detects the API and shows **Sign in**
2. Default account (change after first login):
   - Email: `admin@allocashun.local`
   - Password: `admin123`
3. Pick Admin / MechaTable / Calendar as usual

Shared data (calendars, rules, schedule) is stored in PostgreSQL — every browser sees the same data after login.

---

## 6. Update after code changes

On your PC: commit + push to GitHub.

On the Linux server:

```bash
cd ~/allocashun
git pull
docker compose build
docker compose up -d
```

---

## 7. Useful commands

```bash
# Status
docker compose ps

# Stop
docker compose down

# Restart
docker compose restart

# Backup database
docker compose exec db pg_dump -U allocashun allocashun > backup-$(date +%F).sql

# Restore (careful)
# cat backup.sql | docker compose exec -T db psql -U allocashun allocashun
```

---

## 8. Security checklist (UM)

- Do **not** publish PostgreSQL port 5432 to the internet
- Restrict SSH (key only, firewall)
- Change default admin password ASAP (add a users page or update via SQL + bcrypt)
- Prefer HTTPS (reverse proxy / campus cert) for anything beyond internal UAT
- Ask UM IT for: hostname/DNS, firewall rules, SSL if needed

---

## 9. Local development without Docker

```bash
# Terminal 1 — API (needs local Postgres or docker compose up db only)
cd api && npm install && npm run dev

# Terminal 2 — frontend
npm install
# optional: VITE_USE_API=true VITE_API_URL=http://localhost:3000
npm run dev
```

Without `VITE_USE_API`, the app still uses browser `localStorage` (old behaviour).

---

## 10. Architecture

```
Browser → nginx (web:80) → static React
                └─ /api/* → api:3000 → PostgreSQL (db)
```

Scheduling logic still runs in the browser for preview/generate; results and master data sync through the API into Postgres (run history via `POST /api/schedule-runs`).
