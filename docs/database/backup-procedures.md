# Database Backup & Restore Procedures

This document describes how the Dan Pearson platform database (Supabase
PostgreSQL) is backed up, how to take manual backups, how to verify them, and
how to restore.

> **Golden rule:** always take a fresh backup before running a migration or a
> rollback in any environment that contains real data.

---

## 1. Automated backups (Supabase)

Supabase takes **automated daily snapshots** of the Postgres database:

- **Schedule:** daily (retention depends on plan; Pro retains 7 days of daily
  Point-in-Time-Recovery, higher tiers retain more).
- **Where:** Supabase Dashboard → *Project* → **Database → Backups**.
- **Point-in-Time Recovery (PITR):** on paid plans you can restore to any moment
  within the retention window from the same page.

For the self-hosted (Coolify) deployment, configure the platform's scheduled
`pg_dump`/volume snapshot to run daily and ship the artifact off-box (e.g. to
object storage). The manual procedure below is the same command a scheduled job
should run.

---

## 2. Manual backup (Supabase CLI / pg_dump)

Use the provided script, which runs `pg_dump` and writes a compressed,
timestamped file to `backups/`:

```bash
export SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
npm run db:backup           # or: ./scripts/db-backup.sh
```

- The connection string is read from `SUPABASE_DB_URL` (never commit it).
- Output: `backups/backup-YYYYMMDD-HHMMSS.sql.gz` (UTC).
- The script keeps the 14 most recent backups (override with
  `BACKUP_RETENTION`).

Equivalent raw command:

```bash
pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges --clean --if-exists \
  | gzip > backups/backup-$(date -u +%Y%m%d-%H%M%S).sql.gz
```

You can also use the Supabase CLI:

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" -f backups/backup.sql
```

---

## 3. Verifying a backup

A backup is only useful if it restores. Verify by restoring into a throwaway
database and running a few sanity checks:

```bash
# 1. Create an empty local/scratch database.
createdb backup_verify

# 2. Restore the dump into it.
gunzip -c backups/backup-YYYYMMDD-HHMMSS.sql.gz | psql "postgresql://localhost/backup_verify"

# 3. Sanity-check row counts / key tables.
psql "postgresql://localhost/backup_verify" -c "\dt public.*"
psql "postgresql://localhost/backup_verify" -c "SELECT count(*) FROM public.articles;"

# 4. Drop the scratch database.
dropdb backup_verify
```

Checklist for a "verified" backup:

- [ ] The dump file is non-empty and gunzips without error.
- [ ] Restore completes with no errors.
- [ ] Core tables exist and have expected row counts.
- [ ] Row Level Security policies are present (`\d+ public.articles`).

---

## 4. Restore procedure

> **Restoring overwrites data.** Confirm you are pointed at the correct target
> database and that you have a current backup of that target first.

```bash
export TARGET_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"

# Restore from a compressed dump. The dump was created with --clean --if-exists,
# so it drops and recreates objects as it restores.
gunzip -c backups/backup-YYYYMMDD-HHMMSS.sql.gz | psql "$TARGET_DB_URL"
```

For a **point-in-time** restore, prefer the Supabase Dashboard PITR feature
rather than a `pg_dump` file, as it restores to an exact timestamp.

After a restore:

- [ ] Run smoke tests against the app (`/status`, admin login, a few reads).
- [ ] Confirm edge functions still connect (health-dashboard returns healthy).
- [ ] Re-verify RLS policies are intact.

---

## Related

- `scripts/db-backup.sh` — the manual backup script.
- `docs/database/migration-guide.md` — creating/testing/rolling back migrations.
- `supabase/migrations/rollbacks/` — rollback SQL for recent migrations.
