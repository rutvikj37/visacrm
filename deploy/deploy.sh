#!/usr/bin/env bash
# Update the server to the latest code on GitHub. Run as root on the server:
#   bash /opt/visacrm/deploy/deploy.sh          only rebuilds what changed since the last deploy
#   FULL=1 bash /opt/visacrm/deploy/deploy.sh   reinstall and rebuild everything
# Tip: start it with nohup so a dropped SSH connection can not stop it halfway:
#   nohup bash /opt/visacrm/deploy/deploy.sh > /root/deploy.log 2>&1 &
set -euo pipefail
APP_DIR=/opt/visacrm
STATE="$APP_DIR/.deployed_commit"
cd "$APP_DIR"
say() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }

say "Pulling latest code"
git pull --ff-only
NEW=$(git rev-parse HEAD)
PREV=$(cat "$STATE" 2>/dev/null || true)
if [ "${FULL:-}" = "1" ] || [ -z "$PREV" ] || ! git cat-file -e "$PREV^{commit}" 2>/dev/null; then PREV=""; fi
[ -n "$PREV" ] && echo "changes since $(git log -1 --format=%h "$PREV"):" && git diff --stat "$PREV" "$NEW" | tail -1

# changed <path...>: true when a full deploy or any file under the paths changed since the last deploy
# (paths are from the repo root - run git there, whatever folder the script is in at the time)
changed() { [ -z "$PREV" ] || ! git -C "$APP_DIR" diff --quiet "$PREV" "$NEW" -- "$@"; }
# install: only when the lockfile changed or node_modules is missing
install() {
    if [ -d node_modules ] && ! changed "$(basename "$PWD")/package-lock.json" "$(basename "$PWD")/package.json"; then
        echo "packages unchanged - skipping npm ci"; return
    fi
    rm -rf node_modules   # a half-finished earlier install makes npm ci fail with ENOTEMPTY
    if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
}

BACKEND=abroly_visa_platform_backend
if changed "$BACKEND" || [ ! -f "$APP_DIR/$BACKEND/dist/server.js" ]; then
    say "Backend: install and build"
    cd "$APP_DIR/$BACKEND"
    install
    npm run build
    mkdir -p public

    if changed "$BACKEND/src/model" "$BACKEND/src/config" "$BACKEND/src/scripts/syncDatabase.ts"; then
        say "Database: backup, then add new tables / columns"
        bash "$APP_DIR/deploy/backup-db.sh" || { echo "backup failed - not touching the database"; exit 1; }
        # run without NODE_ENV=production so new columns are added
        NODE_ENV= npm run db:sync
    else
        echo "models unchanged - skipping database sync"
    fi

    say "Restarting the API"
    cd "$APP_DIR"
    pm2 startOrReload deploy/ecosystem.config.js --update-env
    pm2 save >/dev/null
else
    say "Backend unchanged - API keeps running"
fi

export NODE_OPTIONS="--max-old-space-size=2048"
for app in admin agent student; do
    dir="abroly_visa_platform_$app"
    if changed "$dir" || [ ! -f "$APP_DIR/$dir/dist/index.html" ]; then
        say "Building $app"
        cd "$APP_DIR/$dir"
        install
        npm run build
    else
        echo "$app unchanged - skipping build"
    fi
done
cd "$APP_DIR"

say "Nightly database backup (02:30)"
chmod +x "$APP_DIR/deploy/backup-db.sh"
echo "30 2 * * * root bash $APP_DIR/deploy/backup-db.sh >> /var/log/visacrm-backup.log 2>&1" > /etc/cron.d/visacrm-backup
chmod 644 /etc/cron.d/visacrm-backup

if changed deploy; then
    say "Nginx sites and automatic HTTPS"
    bash "$APP_DIR/deploy/install-auto-https.sh"
fi

say "Checking the API"
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:4001/health >/dev/null && break; sleep 2; done
curl -fsS http://127.0.0.1:4001/health && echo " - deploy finished"
echo "$NEW" > "$STATE"
