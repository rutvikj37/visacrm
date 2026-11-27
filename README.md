# TechX CRM

Two separate products, each with its own API, database, white-label agency panel and client portal, plus one shared platform (super) admin:

- **Visa CRM** for visa and study-abroad agencies (`abroly_visa_platform_*`)
- **Travel CRM** for holiday / tour agencies: itineraries, quotes, bookings, suppliers (`travel_crm_*`)

| Folder | App | Stack | Local port |
|---|---|---|---|
| `abroly_visa_platform_backend` | Visa CRM API | Node 20, Express, Sequelize, MySQL / MariaDB | 4001 |
| `abroly_visa_platform_agent` | Visa CRM agency panel | React, Vite, HeroUI | 5175 |
| `abroly_visa_platform_student` | Visa CRM student portal | React, Vite, NextUI | 5176 |
| `travel_crm_backend` | Travel CRM API (own database) | Node 20, Express, Sequelize, MySQL / MariaDB | 4002 |
| `travel_crm_agent` | Travel CRM agency panel | React, Vite, HeroUI | 5185 |
| `travel_crm_portal` | Travel CRM client portal | React, Vite, NextUI | 5186 |
| `abroly_visa_platform_admin` | Platform (super) admin for both (Visa / Travel switch) | React, Vite, NextUI | 5174 |

The two products share no code at runtime: shared features (leads, team, chat, billing …) exist as a copy in each.
A fix to shared code has to be made in both. Travel CRM server setup: [deploy/TRAVEL_CRM_SETUP.md](deploy/TRAVEL_CRM_SETUP.md).

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
   - Frontends: `VITE_API_BASE_URL=http://localhost:4001/api` (Visa CRM apps) or `http://localhost:4002/api` (Travel CRM apps), `VITE_IS_LOCAL=true` for local OTP routes. Admin: also `VITE_TRAVEL_API_BASE_URL=http://localhost:4002/api` to manage the Travel CRM.
   - Travel CRM backend: its own database (for example `travelcrm`, created in the same MariaDB container), `SERVER_PORT=4002` and its own secrets.
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
