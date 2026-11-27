# TechX CRM

CRM for visa and study-abroad agencies: a platform (super) admin, a white-label agency panel, and a student portal per agency.

The **Travel CRM** is a separate product in its own private repo, github.com/rutvikj37/travelcrm (own API, database and deploy,
`/opt/travelcrm` on the same server). The platform admin panel here is shared: its Visa CRM / Travel CRM switch manages either product.

| Folder | App | Stack | Local port |
|---|---|---|---|
| `abroly_visa_platform_backend` | API | Node 20, Express, Sequelize, MySQL / MariaDB | 4001 |
| `abroly_visa_platform_admin` | Platform (super) admin, for both products | React, Vite, NextUI | 5174 |
| `abroly_visa_platform_agent` | Agency panel | React, Vite, HeroUI | 5175 |
| `abroly_visa_platform_student` | Student portal | React, Vite, NextUI | 5176 |

Shared features (leads, team, chat, billing …) exist as a copy in each product's repo, so a fix to them has to be made in both.

## Local setup

1. **Database** (MariaDB 10.11 in Docker, port 3307):
   ```bash
   docker run -d --name abroly-mariadb --restart unless-stopped -p 3307:3306 \
     -e MARIADB_ROOT_PASSWORD=change-me -e MARIADB_DATABASE=abroly_db \
     -e MARIADB_USER=abroly -e MARIADB_PASSWORD=change-me \
     -v abroly_mariadb_data:/var/lib/mysql mariadb:10.11
   ```
2. **Env files**: copy `.env.example` to `.env` in every app and fill it in.
   - Backend: `MYSQL_*` (with `MYSQL_PORT=3307`), `ACCESS_TOKEN_SECRET`, `LOCAL_PATH`, `PUBLIC_API_URL`, `AGENCY_PANEL_URL`, `STUDENT_PORTAL_URL`, mail (`RESEND_API_KEY` + `MAIL_FROM`, or `SMTP_*`). `CLUSTER_WORKERS=2` keeps local restarts fast.
   - Frontends: `VITE_API_BASE_URL=http://localhost:4001/api`, `VITE_IS_LOCAL=true` for local OTP routes. Admin: also `VITE_TRAVEL_API_BASE_URL=http://localhost:4002/api` to manage a local Travel CRM.
3. **Install and create tables**:
   ```bash
   cd abroly_visa_platform_backend && npm install && npm run db:sync
   ```
   then `npm install` in each frontend.
4. **Run**: `npm run dev` in the backend and in each frontend.

## Useful commands (backend)

| Command | What it does |
|---|---|
| `npm run db:sync` | Create / update tables from the models (run after pulling model changes) |
| `npm run demo:seed` | Build the demo agency "Global Pathways Overseas" with data on every page and print login codes (safe to re-run; it resets the demo) |
| `npm run demo:seed:tasks-chats` | Add Tasks Kanban + Portal Chats for the existing demo agency only (does not wipe or change login codes; safe to re-run) |
| `npm run mail:test -- you@example.com` | Send a test email with the current mail settings |

## Logins

- **Platform admin**: mobile number + fixed OTP `111111` (no SMS).
- **Agency owners and team members** created from the admin / agency panel get a 6-digit invite code by email, then set a personal passcode.
- **Students** use the same invite → personal passcode flow (or SMS OTP if no login code is set); demo students get a fixed login code from `npm run demo:seed`.

## Server (Ubuntu + PM2 + MySQL + Nginx)

- First time, as root: `git clone https://github.com/rutvikj37/visacrm.git /opt/visacrm && bash /opt/visacrm/deploy/setup-server.sh`
  (installs Nginx + HTTPS, creates the MySQL database, writes `.env` files with random secrets, builds and starts everything).
- Every update: `bash /opt/visacrm/deploy/deploy.sh`
- Ensure platform admin exists: `cd /opt/visacrm/abroly_visa_platform_backend && npm run admin:code -- <mobile> "Name"` (OTP is always `111111`)
- Local-testing logins (`*_custom` routes, test numbers) only work with `ISLOCAL=yes`, which is never set on a server.

## Notes

- Never commit `.env` files. The old database dumps (`backend/db_backup`) are kept out of git because they contain personal data.
- In production set `CLUSTER_WORKERS` (or leave it unset for one worker per CPU), real `RESEND_API_KEY` / `MAIL_FROM` on a verified domain, and the real panel / portal URLs.
