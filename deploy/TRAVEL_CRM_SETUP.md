# Travel CRM - one-time server setup

The Travel CRM is a separate product from the Visa CRM: its own API, database, agency panel and client portal.
Only the platform admin panel is shared (Visa CRM / Travel CRM switch at the top of the sidebar and on the login page).

| | Visa CRM | Travel CRM |
|---|---|---|
| API | `abroly_visa_platform_backend`, port 4001, https://api.techxsolutions.io | `travel_crm_backend`, port 4002, https://travel-api.techxsolutions.io |
| Database | existing (`.env` MYSQL_DATABASE) | new, e.g. `travelcrm` |
| PM2 process | `visacrm-api` | `travelcrm-api` |
| Agency panel | `abroly_visa_platform_agent` (crm.techxsolutions.io/agency) | `travel_crm_agent` (travel.techxsolutions.io/agency) |
| Client portal | `abroly_visa_platform_student` | `travel_crm_portal` (travel.techxsolutions.io) |

Until `travel_crm_backend/.env` exists, `deploy.sh` skips everything Travel CRM, so the Visa CRM keeps deploying as before.

## 1. DNS (before deploying)

- Add an A record **travel-api.techxsolutions.io** pointing to the server.
- **travel.techxsolutions.io** already points to the server. It now serves the Travel CRM. Before this change it was the
  portal of the Wanderly *tourist-visa* demo agency in the Visa CRM, so first give that agency another subdomain
  (Super admin → Visa CRM → Agencies → Wanderly → portal address). Otherwise both products try to use the address.

`install-auto-https.sh` (run by `deploy.sh`) gets the certificates. If DNS is not ready, certbot fails and the deploy stops.

## 2. Database

```bash
mysql -u root -p -e "CREATE DATABASE travelcrm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'travelcrm'@'localhost' IDENTIFIED BY '<strong password>';
  GRANT ALL PRIVILEGES ON travelcrm.* TO 'travelcrm'@'localhost';"
```

## 3. Env files on the server

- `travel_crm_backend/.env`: start from `.env.example` (or copy the Visa CRM `.env` and change it). It **must** differ from the Visa CRM in:
  - `SERVER_PORT=4002`, `MYSQL_DATABASE` / `MYSQL_USER` / `MYSQL_PASSWORD` = the new database
  - `ACCESS_TOKEN_SECRET`, `FILE_SIGNING_KEY`, `INTEGRATION_ENCRYPTION_KEY`: new random values
  - `DATA_ENCRYPTION_KEY`: new random value (`openssl rand -hex 32`); never change it once travellers are saved
  - `PUBLIC_API_URL=https://travel-api.techxsolutions.io/api`, `AGENCY_PANEL_URL=https://travel.techxsolutions.io/agency`,
    `STUDENT_PORTAL_URL=https://travel.techxsolutions.io`
  - `AWS_S3_BUCKET`: a separate bucket, or the same bucket only if you accept both products' files sitting side by side
- `travel_crm_agent/.env` and `travel_crm_portal/.env`: `VITE_API_BASE_URL=https://travel-api.techxsolutions.io/api`
- `abroly_visa_platform_admin/.env`: add `VITE_TRAVEL_API_BASE_URL=https://travel-api.techxsolutions.io/api` (this turns on the switch)

## 4. Deploy and first admin

```bash
nohup bash /opt/visacrm/deploy/deploy.sh > /root/deploy.log 2>&1 &
```

The first run creates the Travel CRM tables (`db:sync`) and starts `travelcrm-api`. Then create the platform admin for the Travel CRM (its admins are separate):

```bash
cd /opt/visacrm/travel_crm_backend && npm run admin:code -- <10-digit mobile> "Your Name"
```

In the admin panel, switch to **Travel CRM**, log in with that code, set up plans and billing, and create agencies.
For a demo agency: create it in the admin, then run `npm run demo:seed -- <subdomain>` in `travel_crm_backend`.

## 5. Outside services (one per product)

- **Razorpay** (SaaS billing and client payment links): add a second webhook to `https://travel-api.techxsolutions.io/api/v1/public/razorpay/webhook`.
- **Meta** (Facebook / Instagram lead ads, WhatsApp Cloud API): one Meta app has only one webhook URL. Create a separate Meta app
  for the Travel CRM, set its webhook to the travel API (see `travel_crm_backend/docs/META_SETUP.md`), and put its `META_*` values in `travel_crm_backend/.env`.
- **Email** (Resend / SMTP): the same account works. Use a separate `MAIL_FROM` name if you want travel emails branded differently.

## Existing travel data in the Visa CRM database

The Travel CRM tables (`travel_suppliers`, `quotations`, `bookings` …) and any `crm_type = travel/both` agencies stay in the Visa CRM
database untouched. The Visa CRM no longer reads them, and they were demo data only. Drop them later if you want them gone.
