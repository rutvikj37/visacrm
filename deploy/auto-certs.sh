#!/usr/bin/env bash
# Automatic HTTPS for agency portals and panels. Runs every minute (systemd timer visacrm-certs.timer).
#
# For every active agency with a portal address (<sub>.techxsolutions.io or its own domain):
#   1. if the address has no certificate and its DNS already points to this server -> get one (Let's Encrypt)
#   2. write /etc/nginx/visacrm-portals/<address>.conf: student portal at https://<address>/ and the
#      agency panel at https://<address>/agency/ (e.g. rutvik.techxsolutions.io/agency)
#   3. old crm.<address> panel addresses that already have a certificate redirect to <address>/agency
# Addresses whose DNS isn't ready are skipped; a failed attempt waits an hour before retrying
# (keeps us inside Let's Encrypt's limits). Portal files of removed agencies are taken down.
set -uo pipefail

APP_DIR=/opt/visacrm
ENV_FILE=$APP_DIR/abroly_visa_platform_backend/.env
PORTALS=/etc/nginx/visacrm-portals
WEBROOT=/var/www/letsencrypt
STATE=/var/lib/visacrm-certs
RESERVED="api admin crm student www"
PLATFORM_DOMAIN=$(grep -E '^PLATFORM_PORTAL_DOMAIN=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]')
PLATFORM_DOMAIN=${PLATFORM_DOMAIN:-techxsolutions.io}

log() { echo "[visacrm-certs] $*"; }
envv() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }
mkdir -p "$PORTALS" "$WEBROOT" "$STATE"

# this server's public IPv4 (to check DNS before asking Let's Encrypt)
SERVER_IP=$(curl -fsS4 --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

DB_ARGS=(-h "$(envv MYSQL_HOST)" -P "$(envv MYSQL_PORT)" -u "$(envv MYSQL_USER)" "$(envv MYSQL_DATABASE)")
HOSTS=$(MYSQL_PWD="$(envv MYSQL_PASSWORD)" mysql -N -B "${DB_ARGS[@]}" -e "
    SELECT DISTINCT LOWER(CONCAT(IF(sudomain IS NULL OR sudomain = '', '', CONCAT(sudomain, '.')), domain))
    FROM agent
    WHERE role = 'agent' AND status = 'active' AND deletedAt IS NULL AND domain IS NOT NULL AND domain <> ''") || { log "could not read agencies from MySQL"; exit 1; }

# cert <address>: make sure the address has a certificate (asks Let's Encrypt once DNS points here).
# Returns 0 when the certificate is there.
cert() {
    local host=$1
    [ -f "/etc/letsencrypt/live/$host/fullchain.pem" ] && return 0
    if [ -f "$STATE/failed-$host" ] && [ -n "$(find "$STATE/failed-$host" -mmin -60 2>/dev/null)" ]; then return 1; fi
    # ask public resolvers (what Let's Encrypt sees), not the server's own cache, which can
    # remember "does not exist" for up to an hour after a DNS record is added
    # (collect first, then compare: `cmd | grep -q` breaks the pipe and fails under pipefail)
    local ips
    ips=$(dig +short +time=3 +tries=1 A "$host" @1.1.1.1 2>/dev/null; dig +short +time=3 +tries=1 A "$host" @8.8.8.8 2>/dev/null; getent ahostsv4 "$host" 2>/dev/null | awk '{print $1}')
    if ! grep -qx "$SERVER_IP" <<< "$ips"; then
        log "waiting for DNS: $host does not point to $SERVER_IP yet"
        return 1
    fi
    log "getting a certificate for $host"
    if certbot certonly --webroot -w "$WEBROOT" -d "$host" --non-interactive --agree-tos \
            --register-unsafely-without-email --keep-until-expiring --quiet; then
        rm -f "$STATE/failed-$host"
        return 0
    fi
    touch "$STATE/failed-$host"
    log "certificate failed for $host (will retry in an hour)"
    return 1
}

# write_conf <file> < content: replace the site file only when its content changed
write_conf() {
    local f=$1 tmp
    tmp=$(mktemp)
    cat > "$tmp"
    if cmp -s "$tmp" "$f"; then rm -f "$tmp"; return 1; fi
    mv "$tmp" "$f" && chmod 644 "$f"
    changed=1
    return 0
}

changed=0
wanted=" "
for host in $HOSTS; do
    [[ "$host" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] || { log "skip invalid address: $host"; continue; }
    sub=${host%%.*}
    if [ "${host#*.}" = "$PLATFORM_DOMAIN" ] && [[ " $RESERVED " == *" $sub "* ]]; then continue; fi
    wanted+="$host "
    # one address for everyone: student portal at /, agency panel at /agency/
    if cert "$host"; then
        write_conf "$PORTALS/$host.conf" <<NGINX && log "live: https://$host (student portal) and https://$host/agency (agency panel)"
# agency address - written by deploy/auto-certs.sh
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name $host;
    ssl_certificate /etc/letsencrypt/live/$host/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$host/privkey.pem;
    include /etc/nginx/snippets/visacrm-ssl.conf;
    include /etc/nginx/snippets/visacrm-agency.conf;
    root $APP_DIR/abroly_visa_platform_student/dist;
    include /etc/nginx/snippets/visacrm-spa.conf;
}
NGINX
    fi
    # the old panel address crm.<address> -> <address>/agency (only where it already has a certificate)
    if [ -f "/etc/letsencrypt/live/crm.$host/fullchain.pem" ]; then
        wanted+="crm.$host "
        write_conf "$PORTALS/crm.$host.conf" <<NGINX && log "redirect: https://crm.$host -> https://$host/agency"
# old agency panel address - written by deploy/auto-certs.sh
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name crm.$host;
    ssl_certificate /etc/letsencrypt/live/crm.$host/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.$host/privkey.pem;
    include /etc/nginx/snippets/visacrm-ssl.conf;
    location / { return 301 https://$host/agency\$request_uri; }
}
NGINX
    fi
done

# take down portals of agencies that were removed, suspended or changed address (certificates are kept)
for conf in "$PORTALS"/*.conf; do
    [ -e "$conf" ] || continue
    host=$(basename "$conf" .conf)
    if [[ "$wanted" != *" $host "* ]]; then rm -f "$conf"; log "portal removed: $host"; changed=1; fi
done

if [ "$changed" = 1 ]; then
    if nginx -t -q; then systemctl reload nginx && log "nginx reloaded"; else log "nginx config test failed - not reloading"; fi
fi
