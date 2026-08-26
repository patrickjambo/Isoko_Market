#!/usr/bin/env bash
# Manage the self-contained local PostgreSQL cluster for Isoko Market.
# No sudo / no system service needed — the cluster is owned by your user.
#
#   ./scripts/db.sh start | stop | status | reset
#
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/18/bin}"
PGDATA="${PGDATA:-$(cd "$(dirname "$0")/.." && pwd)/.pgdata}"
PGPORT="${PGPORT:-5544}"
PGUSER="${PGUSER:-isoko}"
DBNAME="${DBNAME:-isoko}"
LOG="/tmp/isoko-pg.log"

init() {
  if [ ! -d "$PGDATA/base" ]; then
    echo "› initializing cluster at $PGDATA"
    "$PGBIN/initdb" -D "$PGDATA" -U "$PGUSER" --auth-local=trust --auth-host=trust -E UTF8 >/dev/null
  fi
}

start() {
  init
  if "$PGBIN/pg_isready" -h localhost -p "$PGPORT" >/dev/null 2>&1; then
    echo "✓ already running on :$PGPORT"; return
  fi
  "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PGPORT -k /tmp" -l "$LOG" start
  sleep 1
  "$PGBIN/createdb" -h localhost -p "$PGPORT" -U "$PGUSER" "$DBNAME" 2>/dev/null || true
  "$PGBIN/psql" -h localhost -p "$PGPORT" -U "$PGUSER" -d "$DBNAME" \
    -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" >/dev/null
  echo "✓ started — DATABASE_URL=postgresql://$PGUSER@localhost:$PGPORT/$DBNAME"
}

stop() {
  "$PGBIN/pg_ctl" -D "$PGDATA" stop -m fast || true
}

status() {
  "$PGBIN/pg_isready" -h localhost -p "$PGPORT" || true
}

reset() {
  stop || true
  rm -rf "$PGDATA"
  start
  echo "› cluster reset. Run: npx prisma db push && npm run db:seed"
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  reset) reset ;;
  *) echo "usage: $0 {start|stop|status|reset}"; exit 1 ;;
esac
