#!/usr/bin/env bash
#
# db-backup.sh - Create a timestamped pg_dump backup of the Supabase database.
#
# Usage:
#   SUPABASE_DB_URL="postgresql://user:pass@host:5432/postgres" ./scripts/db-backup.sh
#
# The connection string is read from the SUPABASE_DB_URL environment variable
# (never hardcode credentials). Dumps are written to backups/ with a UTC
# timestamp, e.g. backups/backup-20260716-153000.sql.gz
#
# Requires: pg_dump (PostgreSQL client tools) and gzip on the PATH.

set -euo pipefail

# --- Preconditions -----------------------------------------------------------
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "ERROR: SUPABASE_DB_URL is not set." >&2
  echo "Set it to your Supabase Postgres connection string, e.g.:" >&2
  echo '  export SUPABASE_DB_URL="postgresql://postgres:<pwd>@db.<ref>.supabase.co:5432/postgres"' >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found. Install the PostgreSQL client tools." >&2
  exit 1
fi

# --- Paths -------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${REPO_ROOT}/backups"
mkdir -p "${BACKUP_DIR}"

TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
OUTFILE="${BACKUP_DIR}/backup-${TIMESTAMP}.sql.gz"

# --- Dump --------------------------------------------------------------------
echo "Backing up database to ${OUTFILE} ..."

# --no-owner / --no-privileges keep the dump portable across environments.
# --clean --if-exists makes the dump safe to restore over an existing schema.
if pg_dump "${SUPABASE_DB_URL}" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
  | gzip > "${OUTFILE}"; then
  SIZE="$(du -h "${OUTFILE}" | cut -f1)"
  echo "✅ Backup complete: ${OUTFILE} (${SIZE})"
else
  echo "ERROR: pg_dump failed; removing incomplete file." >&2
  rm -f "${OUTFILE}"
  exit 1
fi

# --- Retention (optional) ----------------------------------------------------
# Keep the 14 most recent backups; delete older ones.
KEEP="${BACKUP_RETENTION:-14}"
mapfile -t OLD < <(ls -1t "${BACKUP_DIR}"/backup-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" || true)
if [[ "${#OLD[@]}" -gt 0 ]]; then
  echo "Pruning $((${#OLD[@]})) backup(s) older than the ${KEEP} most recent."
  rm -f "${OLD[@]}"
fi
