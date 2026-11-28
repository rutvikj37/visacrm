#!/usr/bin/env bash
# Install / refresh the Nginx sites and automatic HTTPS for agency portals. Run as root (safe to re-run;
# deploy.sh runs it on every deploy so the server's Nginx always matches deploy/ in the repo).
set -euo pipefail
APP_DIR=/opt/visacrm
WEBROOT=/var/www/letsencrypt
PLATFORM_HOSTS="api.techxsolutions.io admin.techxsolutions.io crm.techxsolutions.io student.techxsolutions.io"
say() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }

mkdir -p "$WEBROOT" /etc/nginx/visacrm-portals /var/lib/visacrm-certs
cp "$APP_DIR/deploy/nginx-ws-map.conf" /etc/nginx/conf.d/visacrm-ws-map.conf
cp "$APP_DIR/deploy/nginx-spa-snippet.conf" /etc/nginx/snippets/visacrm-spa.conf
cp "$APP_DIR/deploy/nginx-ssl-snippet.conf" /etc/nginx/snippets/visacrm-ssl.conf
cp "$APP_DIR/deploy/nginx-agency-snippet.conf" /etc/nginx/snippets/visacrm-agency.conf
# the agency panel is served at /agency/ on every agency address (see nginx-agency-snippet.conf)
mkdir -p /var/www/visacrm-agency
ln -sfn "$APP_DIR/abroly_visa_platform_agent/dist" /var/www/visacrm-agency/agency

# the platform sites need their certificates before the HTTPS config can load
missing=""
for h in $PLATFORM_HOSTS; do [ -f "/etc/letsencrypt/live/$h/fullchain.pem" ] || missing+=" $h"; done
if [ -n "$missing" ]; then
    say "Getting certificates for:$missing"
    # temporary port-80-only site so Let's Encrypt can reach the webroot
    cat > /etc/nginx/sites-available/visacrm.conf <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    location ^~ /.well-known/acme-challenge/ { root /var/www/letsencrypt; default_type text/plain; }
    location / { return 503; }
}
NGINX
    ln -sf /etc/nginx/sites-available/visacrm.conf /etc/nginx/sites-enabled/visacrm.conf
    rm -f /etc/nginx/sites-enabled/default
    nginx -t -q && systemctl reload nginx
    for h in $missing; do
        certbot certonly --webroot -w "$WEBROOT" -d "$h" --non-interactive --agree-tos --register-unsafely-without-email --quiet
    done
fi

# certificates first issued with the nginx plugin -> renew through the shared webroot instead
for h in $PLATFORM_HOSTS; do
    conf="/etc/letsencrypt/renewal/$h.conf"
    if [ -f "$conf" ] && grep -q "authenticator = nginx" "$conf"; then
        certbot reconfigure --cert-name "$h" --webroot -w "$WEBROOT" --non-interactive --quiet || true
    fi
done

say "Nginx sites"
cp "$APP_DIR/deploy/nginx-visacrm.conf" /etc/nginx/sites-available/visacrm.conf
ln -sf /etc/nginx/sites-available/visacrm.conf /etc/nginx/sites-enabled/visacrm.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

say "Automatic HTTPS for agency portals and panels (every minute)"
install -m 755 "$APP_DIR/deploy/auto-certs.sh" /usr/local/bin/visacrm-auto-certs
cat > /etc/systemd/system/visacrm-certs.service <<'UNIT'
[Unit]
Description=TechX CRM - HTTPS certificates for agency portals
After=network-online.target mysql.service nginx.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/visacrm-auto-certs
UNIT
cat > /etc/systemd/system/visacrm-certs.timer <<'UNIT'
[Unit]
Description=TechX CRM - check agency portal certificates every minute

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min

[Install]
WantedBy=timers.target
UNIT
# instant run: the API writes /var/lib/visacrm-certs/trigger whenever an agency's address is created or
# changed (abroly_visa_platform_backend/src/services/certTrigger.ts), so its certificate is issued in seconds
touch /var/lib/visacrm-certs/trigger
cat > /etc/systemd/system/visacrm-certs.path <<'UNIT'
[Unit]
Description=TechX CRM - HTTPS certificates as soon as an agency address is added

[Path]
PathModified=/var/lib/visacrm-certs/trigger
Unit=visacrm-certs.service

[Install]
WantedBy=multi-user.target
UNIT
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nsystemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
systemctl daemon-reload
systemctl enable --now visacrm-certs.timer >/dev/null
systemctl enable --now visacrm-certs.path >/dev/null
systemctl start visacrm-certs.service || true
journalctl -u visacrm-certs.service -n 20 --no-pager -o cat | grep visacrm-certs || true
