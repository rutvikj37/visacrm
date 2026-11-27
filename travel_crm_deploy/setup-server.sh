#!/usr/bin/env bash
# One-time Travel CRM setup on the server that already runs the Visa CRM (/opt/visacrm). Run as root:
#   bash setup-server.sh            (from a copy of this file, or /opt/travelcrm/deploy/setup-server.sh)
# Needs: DNS for travel-api.techxsolutions.io and travel.techxsolutions.io pointing to this server, and
# the read-only deploy key it prints added to github.com/rutvikj37/travelcrm (Settings -> Deploy keys).
# Safe to run again: existing .env files, database and certificates are kept.
set -euo pipefail

APP_DIR=/opt/travelcrm
VISA_DIR=/opt/visacrm
REPO=git@github.com:rutvikj37/travelcrm.git
KEY=/root/.ssh/travelcrm_deploy
API=travel-api.techxsolutions.io
SITE=travel.techxsolutions.io
DB_NAME=travelcrm
DB_USER=travelcrm

say() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
rand() { openssl rand -hex "${1:-32}"; }
[ -d "$VISA_DIR" ] || { echo "$VISA_DIR not found - this script adds the Travel CRM next to the Visa CRM"; exit 1; }

say "GitHub deploy key (read-only access to the private travelcrm repo)"
if [ ! -f "$KEY" ]; then
    ssh-keygen -t ed25519 -N "" -C "travelcrm-vps-deploy" -f "$KEY" >/dev/null
    echo "Add this public key to github.com/rutvikj37/travelcrm -> Settings -> Deploy keys (read-only), then run this script again:"
    cat "$KEY.pub"
    exit 0
fi
export GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

say "Getting the code"
if [ -d "$APP_DIR/.git" ]; then git -C "$APP_DIR" pull --ff-only; else git clone "$REPO" "$APP_DIR"; fi
# later pulls (deploy.sh) use the same key
git -C "$APP_DIR" config core.sshCommand "ssh -i $KEY -o IdentitiesOnly=yes"

say "MySQL database and user"
BACKEND_ENV="$APP_DIR/travel_crm_backend/.env"
if [ -f "$BACKEND_ENV" ]; then
    DB_PASS=$(grep -E '^MYSQL_PASSWORD=' "$BACKEND_ENV" | cut -d= -f2-)
else
    DB_PASS=$(rand 18)
fi
mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
SQL

# mail and Razorpay keys are reused from the Visa CRM (same accounts); everything secret is new
visa() { grep -E "^$1=" "$VISA_DIR/abroly_visa_platform_backend/.env" | tail -1 | cut -d= -f2- || true; }
if [ ! -f "$BACKEND_ENV" ]; then
    say "Writing backend .env (new random secrets)"
    cat > "$BACKEND_ENV" <<ENV
NODE_ENV=production
SERVER_PORT=4002
CLUSTER_WORKERS=2

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=$DB_NAME
MYSQL_USER=$DB_USER
MYSQL_PASSWORD=$DB_PASS

ACCESS_TOKEN_SECRET=$(rand 32)
INTEGRATION_ENCRYPTION_KEY=$(rand 32)
FILE_SIGNING_KEY=$(rand 32)
# encrypts passport / PAN / bank details - never change it once travellers are saved
DATA_ENCRYPTION_KEY=$(rand 32)
CERT_TRIGGER_FILE=/var/lib/travelcrm-certs/trigger

LOCAL_PATH=https://$API/
PUBLIC_API_URL=https://$API/api
AGENCY_PANEL_URL=https://$SITE/agency
STUDENT_PORTAL_URL=https://$SITE
PLATFORM_PORTAL_DOMAIN=techxsolutions.io

RESEND_API_KEY=$(visa RESEND_API_KEY)
MAIL_FROM=$(visa MAIL_FROM)
MAIL_FROM_NAME=TechX Travel CRM
SMTP_EMAIL=$(visa SMTP_EMAIL)
SMTP_PASSWORD=$(visa SMTP_PASSWORD)
SMTP_HOST=$(visa SMTP_HOST)
SMTP_PORT=$(visa SMTP_PORT)
SAAS_SUPPORT_PHONE=$(visa SAAS_SUPPORT_PHONE)
SAAS_SUPPORT_EMAIL=$(visa SAAS_SUPPORT_EMAIL)
SAAS_ADMIN_EMAIL=$(visa SAAS_ADMIN_EMAIL)

# Razorpay: same account; add a webhook to https://$API/api/v1/public/razorpay/webhook and put its secret here
RAZORPAY_KEY_ID=$(visa RAZORPAY_KEY_ID)
RAZORPAY_KEY_SECRET=$(visa RAZORPAY_KEY_SECRET)
RAZORPAY_WEBHOOK_SECRET=

# Meta: a separate Meta app for the Travel CRM (one app has one webhook URL) - see travel_crm_backend/docs/META_SETUP.md
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=
META_LOGIN_CONFIG_ID=
META_GRAPH_VERSION=v21.0

# S3: empty = files on this server's disk. Use a separate bucket from the Visa CRM.
AWS_S3_BUCKET=
ENV
    chmod 600 "$BACKEND_ENV"
fi

for app in travel_crm_agent travel_crm_portal; do
    f="$APP_DIR/$app/.env.production"
    [ -f "$f" ] && continue
    cat > "$f" <<ENV
VITE_API_BASE_URL=https://$API/api
VITE_SOCKET_SERVER_URL=https://$API
VITE_IS_LOCAL=false
ENV
    [ "$app" = "travel_crm_agent" ] && echo "VITE_GOOGLE_PLACES_API_KEY=$(grep -E '^VITE_GOOGLE_PLACES_API_KEY=' "$VISA_DIR/abroly_visa_platform_agent/.env.production" 2>/dev/null | cut -d= -f2-)" >> "$f"
done

say "Installing, building, starting and HTTPS (deploy.sh)"
FULL=1 bash "$APP_DIR/deploy/deploy.sh"
bash "$APP_DIR/deploy/install-auto-https.sh"
pm2 save

say "Shared admin panel: turn on the Visa / Travel switch"
ADMIN_ENV="$VISA_DIR/abroly_visa_platform_admin/.env.production"
if ! grep -q '^VITE_TRAVEL_API_BASE_URL=' "$ADMIN_ENV" 2>/dev/null; then
    echo "VITE_TRAVEL_API_BASE_URL=https://$API/api" >> "$ADMIN_ENV"
    (cd "$VISA_DIR/abroly_visa_platform_admin" && NODE_OPTIONS="--max-old-space-size=2048" npm run build)
fi

say "Done"
echo "  API      https://$API/health"
echo "  Panel    https://$SITE/agency"
echo "  Admin    https://admin.techxsolutions.io (switch to Travel CRM)"
echo "Next: cd $APP_DIR/travel_crm_backend && npm run admin:code -- <your mobile> \"Your name\""
