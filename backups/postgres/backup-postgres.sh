#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${KEEP_DAYS:-8}"
COMPRESS_LEVEL="${COMPRESS_LEVEL:-6}"
PREFIX="${PREFIX:-bilet}"
STAMP="$(date -u +%Y-%m-%d_%H%M%SZ)"
TARGET="${OUT_DIR}/${PREFIX}-${STAMP}.sql.gz"
PART="${TARGET}.part"

# Coolify PostgreSQL servisleri için iç ağ adreslerini dönüştürür
if [ -z "${DATABASE_URL:-}" ] && [ -n "${DB_PASSWORD:-}" ]; then
  export DATABASE_URL="postgres://postgres:${DB_PASSWORD}@db:5432/postgres"
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL tanımlı değil (Supabase için Settings > Database > Connection string > URI, 'Database connection string' olanı seçin)." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -f "${OUT_DIR}/${PREFIX}-"*.sql.gz.part
trap 'rm -f "$PART"' EXIT

echo "[backup] ${STAMP} start"
pg_dump --no-owner --no-privileges --format=plain "$DATABASE_URL" | gzip -"$COMPRESS_LEVEL" > "$PART"

BYTES=$(wc -c < "$PART")
if ! zcat "$PART" 2>/dev/null | head -n 3 | grep -qi "PostgreSQL database dump"; then
  echo "[backup] FAIL: dump başlığı yok, çıktı bozuk. $PART siliniyor." >&2
  rm -f "$PART"
  exit 1
fi
if [ "$BYTES" -lt 200 ]; then
  echo "[backup] FAIL: çıktı ${BYTES} bayt, boş görünüyor. $PART siliniyor." >&2
  rm -f "$PART"
  exit 1
fi

mv "$PART" "$TARGET"
gzip -t "$TARGET"
echo "[backup] OK: $TARGET ($(du -h "$TARGET" | cut -f1))"

DELETED=$(find "$OUT_DIR" -maxdepth 1 -name "${PREFIX}-*.sql.gz" -type f -mtime +"$KEEP_DAYS" -print -delete | wc -l)
echo "[backup] retention: ${KEEP_DAYS} günden eski ${DELETED} dosya silindi"
echo "[backup] toplam: $(find "$OUT_DIR" -maxdepth 1 -name "${PREFIX}-*.sql.gz" -type f | wc -l) dosya, $(du -sh "$OUT_DIR" | cut -f1)"

# SCHEDULER_ONESHOT=1: Coolify Schedule'lar job gibi çalıştırdığında exit etsin
if [ "${SCHEDULER_ONESHOT:-0}" = "1" ]; then exit 0; fi
echo "[backup] bekliyor (SCHEDULER_ONESHOT=1 ise exit eder)"
while :; do sleep 3600; done
