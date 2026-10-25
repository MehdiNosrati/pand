#!/usr/bin/env bash
set -euo pipefail

DATE_STR="$(date -u +"%Y%m%dT%H%M%SZ")"
METRICS_DIR="/opt/pand/data/backups"
mkdir -p "$METRICS_DIR"

# 1. WAL-G base backup + retain last 7 full backups
if command -v wal-g >/dev/null 2>&1 && [[ -n "${WALG_S3_PREFIX:-}" ]]; then
  wal-g backup-push "${PGDATA:-/var/lib/postgresql/data}"
  wal-g delete retain FULL 7 --confirm
fi

# 2. Per-database logical pg_dump encrypted with age to Cloudflare R2
PUBLIC_KEY="${PAND_AGE_PUBLIC_KEY:-}"
R2_BUCKET="${PAND_BACKUP_BUCKET:-s3://pand-backups}"
R2_ENDPOINT="${PAND_R2_ENDPOINT:-}"

DBS=$(psql -U "${POSTGRES_USER:-pand}" -Atc "SELECT datname FROM pg_database WHERE datistemplate = false AND datname LIKE '%_prod';")

for DB in $DBS; do
  TMP_DUMP="/tmp/${DB}-${DATE_STR}.dump.age"
  if [[ -n "$PUBLIC_KEY" ]]; then
    pg_dump -U "${POSTGRES_USER:-pand}" -Fc "$DB" | age -r "$PUBLIC_KEY" > "$TMP_DUMP"
  else
    pg_dump -U "${POSTGRES_USER:-pand}" -Fc "$DB" > "$TMP_DUMP"
  fi

  if [[ -n "$R2_ENDPOINT" ]]; then
    aws --endpoint-url "$R2_ENDPOINT" s3 cp "$TMP_DUMP" "${R2_BUCKET}/dumps/${DB}/${DATE_STR}.dump.age"
  fi
  rm -f "$TMP_DUMP"
done

# 3. Write Prometheus textfile metric
NOW_TS="$(date -u +%s)"
cat <<EOF > "${METRICS_DIR}/last_backup.prom"
# HELP pand_backup_last_success_timestamp_seconds Unix timestamp of last successful nightly backup
# TYPE pand_backup_last_success_timestamp_seconds gauge
pand_backup_last_success_timestamp_seconds ${NOW_TS}
EOF
