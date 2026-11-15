#!/usr/bin/env bash
# One-time server setup for TechX CRM on Ubuntu (Node.js, PM2 and MySQL already installed). Run as root:
#   bash /opt/visacrm/deploy/setup-server.sh
# Optional: /root/visacrm-secrets.env with RESEND_API_KEY=..., MAIL_FROM=..., VITE_GOOGLE_PLACES_API_KEY=...
# Safe to run again: existing .env files, database and certificates are kept.
set -euo pipefail

APP_DIR=/opt/visacrm
REPO=https://github.com/rutvikj37/visacrm.git
API=api.techxsolutions.io
ADMIN=admin.techxsolutions.io
CRM=crm.techxsolutions.io
STUDENT=student.techxsolutions.io
DB_NAME=visacrm
DB_USER=visacrm
SECRETS=/root/visacrm-secrets.env

say() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
rand() { openssl rand -hex "${1:-32}"; }

export DEBIAN_FRONTEND=noninteractive
say "Installing Nginx, Certbot, git and curl"
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx git openssl curl ca-certificates >/dev/null

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
    say "Installing Node.js 20"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1 || true
    apt-get install -y -qq nodejs >/dev/null
fi
command -v pm2 >/dev/null || { say "Installing PM2"; npm install -g pm2 --no-audit --no-fund >/dev/null; }

say "Versions"
echo "node $(node -v), npm $(npm -v), pm2 $(pm2 -v)"; mysql --version

# small servers: add 2 GB swap so the frontend builds don't run out of memory
if [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 3000 ] && ! swapon --show | grep -q swapfile; then
    say "Adding 2 GB swap"
    fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

say "Getting the code"
if [ -d "$APP_DIR/.git" ]; then git -C "$APP_DIR" pull --ff-only; else git clone "$REPO" "$APP_DIR"; fi

say "MySQL database and user"
BACKEND_ENV="$APP_DIR/abroly_visa_platform_backend/.env"
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

secret() { [ -f "$SECRETS" ] && grep -E "^$1=" "$SECRETS" | cut -d= -f2- || true; }

if [ ! -f "$BACKEND_ENV" ]; then
    say "Writing backend .env (random secrets)"
    cat > "$BACKEND_ENV" <<ENV
NODE_ENV=production
SERVER_PORT=4001
CLUSTER_WORKERS=2

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=$DB_NAME
MYSQL_USER=$DB_USER
MYSQL_PASSWORD=$DB_PASS

ACCESS_TOKEN_SECRET=$(rand 32)
INTEGRATION_ENCRYPTION_KEY=$(rand 32)
FILE_SIGNING_KEY=$(rand 32)

LOCAL_PATH=https://$API/
PUBLIC_API_URL=https://$API/api
AGENCY_PANEL_URL=https://$CRM
STUDENT_PORTAL_URL=https://$STUDENT
# agency portals live at <agency>.techxsolutions.io
PLATFORM_PORTAL_DOMAIN=techxsolutions.io

RESEND_API_KEY=$(secret RESEND_API_KEY)
MAIL_FROM=$(secret MAIL_FROM)
MAIL_FROM_NAME=TechX CRM
ENV
    chmod 600 "$BACKEND_ENV"
fi

for app in admin agent student; do
    f="$APP_DIR/abroly_visa_platform_$app/.env.production"
    [ -f "$f" ] && continue
    cat > "$f" <<ENV
VITE_API_BASE_URL=https://$API/api
VITE_SOCKET_SERVER_URL=https://$API
VITE_IS_LOCAL=false
ENV
    [ "$app" = "agent" ] && echo "VITE_GOOGLE_PLACES_API_KEY=$(secret VITE_GOOGLE_PLACES_API_KEY)" >> "$f"
done
[ -f "$SECRETS" ] && shred -u "$SECRETS" 2>/dev/null || rm -f "$SECRETS"

say "Installing, building, starting and HTTPS (deploy.sh)"
bash "$APP_DIR/deploy/deploy.sh"

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow 'Nginx Full' >/dev/null; fi

say "Start on boot"
pm2 startup systemd -u root --hp /root >/dev/null || true
pm2 save

say "Done"
echo "  API      https://$API/health"
echo "  Admin    https://$ADMIN"
echo "  Agency   https://$CRM"
echo "  Student  https://$STUDENT"
echo "Next: cd $APP_DIR/abroly_visa_platform_backend && npm run admin:code -- <your mobile> \"Your name\""
