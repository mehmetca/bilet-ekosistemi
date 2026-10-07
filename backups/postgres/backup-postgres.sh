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
# Alternatif: bağlantı bilgilerini ayrı ayrı ver (DATABASE_URL'i hiç kurmadan)
# PGHOST=dbxxxx.supabase.co  PGPORT=5432  PGUSER=postgres  PGPASSWORD=...  PGDATABASE=postgres
if [ -z "${DATABASE_URL:-}" ] && [ -n "${PGHOST:-}" ] && [ -n "${PGPASSWORD:-}" ]; then
  export DATABASE_URL="postgres://${PGUSER:-postgres}@${PGHOST}:${PGPORT:-5432}/${PGDATABASE:-postgres}"
fi
if [ -z "${DATABASE_URL:-}" ] && [ -z "${PGHOST:-}" ]; then
  echo "DATABASE_URL bulunamadı. Supabase Connect > Postgres > 'Direct connection' satırını olduğu gibi gir: postgresql://postgres:sifre@db.dzncmwjffopednfgjwlo.supabase.co:5432/postgres" >&2
  exit 1
fi

# Tek satır URL'i libpq değişkenlerine çevir: parola ne argv'de ne hata çıktısında görünür,
# parola içinde @ : / gibi karakter olsa bile bozulmaz.
if [[ "$DATABASE_URL" == *://*:*@* ]]; then
  _rest=${DATABASE_URL#*://}
  _cred=${_rest%@*}
  _hostdb=${_rest##*@}
  export PGPASSWORD=${_cred#*:}
  export PGUSER=${_cred%%:*}
  export PGDATABASE=${_hostdb##*/}
  _hp=${_hostdb%/*}
  if [[ "$_hp" == *:* ]]; then
    export PGPORT=${_hp##*:}
    export PGHOST=${_hp%:*}
  else
    export PGHOST=$_hp
  fi
  unset DATABASE_URL
fi

mkdir -p "$OUT_DIR"
rm -f "${OUT_DIR}/${PREFIX}-"*.sql.gz.part
trap 'rm -f "$PART"' EXIT

echo "[backup] ${STAMP} start"
pg_dump --no-owner --no-privileges --format=plain ${DATABASE_URL:+"$DATABASE_URL"} | gzip -"$COMPRESS_LEVEL" > "$PART"

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
