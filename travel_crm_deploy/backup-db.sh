#!/usr/bin/env bash
# Nightly Travel CRM MySQL backup: dump -> gzip -> keep 7 days in /var/backups/travelcrm -> upload to S3 (keeps 30 days).
# Installed as a cron job by deploy.sh. Run by hand:  bash /opt/travelcrm/deploy/backup-db.sh
set -euo pipefail
APP_DIR=/opt/travelcrm
BACKEND="$APP_DIR/travel_crm_backend"
OUT_DIR=/var/backups/travelcrm
mkdir -p "$OUT_DIR" && chmod 700 "$OUT_DIR"

# read DB settings from the backend .env (never put the password on the command line)
get() { grep -E "^$1=" "$BACKEND/.env" | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
DB=$(get MYSQL_DATABASE); USER=$(get MYSQL_USER); PASS=$(get MYSQL_PASSWORD); HOST=$(get MYSQL_HOST); PORT=$(get MYSQL_PORT)
CNF=$(mktemp); chmod 600 "$CNF"; trap 'rm -f "$CNF"' EXIT
printf "[client]\nuser=%s\npassword=%s\nhost=%s\nport=%s\n" "$USER" "$PASS" "${HOST:-127.0.0.1}" "${PORT:-3306}" > "$CNF"

FILE="$OUT_DIR/$DB-$(date -u +%Y%m%d-%H%M%S).sql.gz"
mysqldump --defaults-extra-file="$CNF" --single-transaction --quick --routines --triggers --no-tablespaces "$DB" | gzip -9 > "$FILE"
chmod 600 "$FILE"
echo "backup written: $FILE ($(du -h "$FILE" | cut -f1))"

# keep 7 days on this server
find "$OUT_DIR" -name "*.sql.gz" -mtime +7 -delete

# copy to S3 when the bucket is configured
cd "$BACKEND" && node dist/scripts/uploadBackup.js "$FILE" || echo "WARNING: S3 upload failed - local copy kept in $OUT_DIR"
