# Travel CRM - server

The Travel CRM runs on the same VPS as the Visa CRM, fully apart from it:

| | Visa CRM | Travel CRM |
|---|---|---|
| Repo | github.com/rutvikj37/visacrm (public) | github.com/rutvikj37/travelcrm (private) |
| Folder | `/opt/visacrm` | `/opt/travelcrm` |
| Deploy | `bash /opt/visacrm/deploy/deploy.sh` | `bash /opt/travelcrm/deploy/deploy.sh` |
| API | port 4001, PM2 `visacrm-api`, https://api.techxsolutions.io | port 4002, PM2 `travelcrm-api`, https://travel-api.techxsolutions.io |
| Database | `visacrm` | `travelcrm` |
| Nginx | `sites-available/visacrm.conf`, `visacrm-portals/` | `sites-available/travelcrm.conf`, `travelcrm-portals/` |
| Certificates job | `visacrm-certs.timer` | `travelcrm-certs.timer` |
| Backups | `/var/backups/visacrm`, 02:30 | `/var/backups/travelcrm`, 02:45 |

Shared on the server: Nginx itself, MySQL, the Let's Encrypt webroot, and the platform **admin panel**
(admin.techxsolutions.io, built from the visacrm repo, with a Visa CRM / Travel CRM switch). The Visa CRM's Nginx file owns
the port 80 site and the default HTTPS site, so set up the Visa CRM first.

## First time

1. **DNS**: an A record for `travel-api.techxsolutions.io` pointing to the server. `travel.techxsolutions.io` must point there too.
   It was the Wanderly tourist-visa demo's portal in the Visa CRM, so move that agency to another subdomain first.
2. Copy `deploy/setup-server.sh` to the server and run it as root. The first run prints a deploy key: add it to
   github.com/rutvikj37/travelcrm → Settings → Deploy keys (read-only), then run the script again. It then:
   - clones the repo to `/opt/travelcrm`;
   - creates the `travelcrm` database and a `.env` with new secrets (mail and Razorpay keys copied from the Visa CRM);
   - builds everything, starts `travelcrm-api` and gets the certificates;
   - turns on the Travel switch in the shared admin panel.
3. Create the Travel CRM platform admin (its admins are separate from the Visa CRM's):
   `cd /opt/travelcrm/travel_crm_backend && npm run admin:code -- <mobile> "Your name"`
4. In the admin panel, switch to **Travel CRM**, log in, set up plans and billing, and create agencies.
   Demo agency: create it, then `npm run demo:seed -- <subdomain>` in `travel_crm_backend`.

## Outside services

- **Razorpay**: add a webhook to `https://travel-api.techxsolutions.io/api/v1/public/razorpay/webhook` and put its secret in `RAZORPAY_WEBHOOK_SECRET`.
- **Meta** (lead ads, WhatsApp): one Meta app has only one webhook URL, so the Travel CRM needs its own app (`travel_crm_backend/docs/META_SETUP.md`).
- **S3**: empty by default (files on disk). If you use S3, use a separate bucket from the Visa CRM.

## Updates

Push to `main` of the travelcrm repo, then on the server:

```bash
nohup bash /opt/travelcrm/deploy/deploy.sh > /root/travelcrm-deploy.log 2>&1 &
```

An agency address used by both products stays with the Visa CRM; the Travel CRM certificates job skips it and logs that.
