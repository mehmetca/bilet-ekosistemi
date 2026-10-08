#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-daemon}"
case "$MODE" in
  run|daemon) ;;
  *) echo "Kullanım: backup-postgres.sh [run|daemon]  (run = tek yedek al ve çık)" >&2; exit 64 ;;
esac

OUT_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${KEEP_DAYS:-8}"
COMPRESS_LEVEL="${COMPRESS_LEVEL:-6}"
PREFIX="${PREFIX:-bilet}"
STAMP="$(date -u +%Y-%m-%d_%H%M%SZ)"
TARGET="${OUT_DIR}/${PREFIX}-${STAMP}.sql.gz"
PART="${TARGET}.part"

do_backup() {
  # Bağlantıyı her zaman libpq değişkenlerine çevir: parola ne argv'de ne hata çıktısında görünür,
  # parola içinde @ : / gibi karakter olsa bile bozulmaz.
  if [ -n "${DATABASE_URL:-}" ] && [[ "$DATABASE_URL" == *://*:*@* ]]; then
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
  fi
  unset DATABASE_URL

  # Coolify'nin kendi Postgres servisi için kısayol (Supabase'de gerekmez)
  if [ -z "${PGHOST:-}" ] && [ -n "${DB_PASSWORD:-}" ]; then
    export PGHOST=db PGUSER=postgres PGDATABASE=postgres PGPORT=5432 PGPASSWORD="$DB_PASSWORD"
  fi
  if [ -z "${PGHOST:-}" ]; then
    echo "[backup] FAIL: DATABASE_URL boş. Supabase Connect > Postgres > 'Direct connection' satırını olduğu gibi DATABASE_URL olarak gir: postgresql://postgres:sifre@db.dzncmwjffopednfgjwlo.supabase.co:5432/postgres" >&2
    return 1
  fi
  export PGPORT="${PGPORT:-5432}"
  echo "[backup] hedef: ${PGHOST}:${PGPORT}/${PGDATABASE} (user=${PGUSER})"

  mkdir -p "$OUT_DIR"
  rm -f "${OUT_DIR}/${PREFIX}-"*.sql.gz.part

  echo "[backup] ${STAMP} start"
  pg_dump --no-owner --no-privileges --format=plain | gzip -"$COMPRESS_LEVEL" > "$PART"

  BYTES=$(wc -c < "$PART")
  if ! zcat "$PART" 2>/dev/null | head -n 3 | grep -qi "PostgreSQL database dump"; then
    echo "[backup] FAIL: dump başlığı yok, çıktı bozuk. $PART siliniyor." >&2
    rm -f "$PART"
    return 1
  fi
  if [ "$BYTES" -lt 200 ]; then
    echo "[backup] FAIL: çıktı ${BYTES} bayt, boş görünüyor. $PART siliniyor." >&2
    rm -f "$PART"
    return 1
  fi

  mv "$PART" "$TARGET"
  gzip -t "$TARGET"
  echo "[backup] OK: $TARGET ($(du -h "$TARGET" | cut -f1))"

  DELETED=$(find "$OUT_DIR" -maxdepth 1 -name "${PREFIX}-*.sql.gz" -type f -mtime +"$KEEP_DAYS" -print -delete | wc -l)
  echo "[backup] retention: ${KEEP_DAYS} günden eski ${DELETED} dosya silindi"
  echo "[backup] toplam: $(find "$OUT_DIR" -maxdepth 1 -name "${PREFIX}-*.sql.gz" -type f | wc -l) dosya, $(du -sh "$OUT_DIR" | cut -f1)"
}

# Hata olsa bile yarım dosya diskte kalmasın.
trap 'rm -f "$PART"' EXIT

if [ "$MODE" = "run" ] || [ "${SCHEDULER_ONESHOT:-0}" = "1" ]; then
  do_backup
  exit $?
fi

# Coolify Scheduled Tasks bu komutu çalışan konteynerin İÇİNDE çalıştırıyor (yeni konteyner
# açmıyor). O yüzden daemon hatada ölmemez: ilk deneme başarısızsa sebep çıktıda kalır,
# konteyner ayakta durur ve planlı iş her çalıştığında yeniden dener.
if ! do_backup; then
  echo "[backup] daemon: ilk deneme başarısız, konteyner ayakta kalıyor."
  echo "[backup] daemon: sebebi görmek için konteyner içinde: backup-postgres.sh run"
fi
echo "[backup] daemon: planlı çalışma bekleniyor (Scheduled Tasks komutu: backup-postgres.sh run)"
while :; do sleep 3600; done
