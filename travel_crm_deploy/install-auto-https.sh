#!/usr/bin/env bash
# Install / refresh the Travel CRM Nginx sites and automatic HTTPS for its agency portals. Run as root (safe to
# re-run; deploy.sh runs it when deploy/ changes). Needs the Visa CRM's Nginx setup on the same server
# (/opt/visacrm/deploy/install-auto-https.sh): it owns the port 80 site and the default HTTPS site.
set -euo pipefail
APP_DIR=/opt/travelcrm
WEBROOT=/var/www/letsencrypt
PLATFORM_HOSTS="travel-api.techxsolutions.io travel.techxsolutions.io"
say() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }

[ -d "$WEBROOT" ] || { echo "$WEBROOT missing - set up the Visa CRM's Nginx first (/opt/visacrm/deploy/install-auto-https.sh)"; exit 1; }
mkdir -p /etc/nginx/travelcrm-portals /var/lib/travelcrm-certs
cp "$APP_DIR/deploy/nginx-spa-snippet.conf" /etc/nginx/snippets/travelcrm-spa.conf
cp "$APP_DIR/deploy/nginx-ssl-snippet.conf" /etc/nginx/snippets/travelcrm-ssl.conf
cp "$APP_DIR/deploy/nginx-agency-snippet.conf" /etc/nginx/snippets/travelcrm-agency.conf
# the agency panel is served at /agency/ on every Travel CRM address (see nginx-agency-snippet.conf)
mkdir -p /var/www/travelcrm-agency
ln -sfn "$APP_DIR/travel_crm_agent/dist" /var/www/travelcrm-agency/agency

# the sites need their certificates before the HTTPS config can load; the Visa CRM's port 80 site
# already answers Let's Encrypt from the shared webroot
for h in $PLATFORM_HOSTS; do
    if [ ! -f "/etc/letsencrypt/live/$h/fullchain.pem" ]; then
        say "Getting a certificate for $h"
        certbot certonly --webroot -w "$WEBROOT" -d "$h" --non-interactive --agree-tos --register-unsafely-without-email --quiet \
            || { echo "certificate for $h failed - does its DNS point to this server?"; exit 1; }
    fi
done

say "Nginx sites"
cp "$APP_DIR/deploy/nginx-travelcrm.conf" /etc/nginx/sites-available/travelcrm.conf
ln -sf /etc/nginx/sites-available/travelcrm.conf /etc/nginx/sites-enabled/travelcrm.conf
nginx -t && systemctl reload nginx

say "Automatic HTTPS for Travel CRM agency portals (every minute)"
install -m 755 "$APP_DIR/deploy/auto-certs.sh" /usr/local/bin/travelcrm-auto-certs
cat > /etc/systemd/system/travelcrm-certs.service <<'UNIT'
[Unit]
Description=Travel CRM - HTTPS certificates for agency portals
After=network-online.target mysql.service nginx.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/travelcrm-auto-certs
UNIT
cat > /etc/systemd/system/travelcrm-certs.timer <<'UNIT'
[Unit]
Description=Travel CRM - check agency portal certificates every minute

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min

[Install]
WantedBy=timers.target
UNIT
# instant run: the API writes /var/lib/travelcrm-certs/trigger whenever an agency's address is created or
# changed (travel_crm_backend/src/services/certTrigger.ts), so its certificate is issued in seconds
touch /var/lib/travelcrm-certs/trigger
cat > /etc/systemd/system/travelcrm-certs.path <<'UNIT'
[Unit]
Description=Travel CRM - HTTPS certificates as soon as an agency address is added

[Path]
PathModified=/var/lib/travelcrm-certs/trigger
Unit=travelcrm-certs.service

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now travelcrm-certs.timer >/dev/null
systemctl enable --now travelcrm-certs.path >/dev/null
systemctl start travelcrm-certs.service || true
journalctl -u travelcrm-certs.service -n 20 --no-pager -o cat | grep travelcrm-certs || true
