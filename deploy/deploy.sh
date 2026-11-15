#!/usr/bin/env bash
# Update the server to the latest code on GitHub. Run as root on the server:
#   bash /opt/visacrm/deploy/deploy.sh
set -euo pipefail
APP_DIR=/opt/visacrm
cd "$APP_DIR"
say() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
install() { if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi; }

say "Pulling latest code"
git pull --ff-only

say "Backend: install, build, update tables"
cd "$APP_DIR/abroly_visa_platform_backend"
install
npm run build
# creates new tables / columns from the models (run without NODE_ENV=production so new columns are added)
NODE_ENV= npm run db:sync
mkdir -p public

say "Restarting the API"
cd "$APP_DIR"
pm2 startOrReload deploy/ecosystem.config.js --update-env
pm2 save >/dev/null

export NODE_OPTIONS="--max-old-space-size=2048"
for app in admin agent student; do
    say "Building $app"
    cd "$APP_DIR/abroly_visa_platform_$app"
    install
    npm run build
done

say "Checking the API"
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:4001/health >/dev/null && break; sleep 2; done
curl -fsS http://127.0.0.1:4001/health && echo " - deploy finished"
