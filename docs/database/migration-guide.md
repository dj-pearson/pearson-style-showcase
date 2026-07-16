# Database Migration Guide

How to create, test, and roll back database migrations for the Supabase
Postgres database.

Migrations live in `supabase/migrations/` and are applied in **timestamp
order**. Rollback scripts live in `supabase/migrations/rollbacks/` and share the
filename of the migration they reverse.

---

## Creating a new migration

1. Generate a timestamped migration file:

   ```bash
   supabase migration new short_description
   # -> supabase/migrations/<timestamp>_short_description.sql
   ```

   If not using the CLI, create the file manually with a UTC timestamp prefix:
   `YYYYMMDDHHMMSS_short_description.sql`.

2. Write **idempotent, forward-only** DDL:
   - Use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `CREATE OR REPLACE FUNCTION`, `DROP ... IF EXISTS`.
   - Wrap multi-statement changes in a single `BEGIN; ... COMMIT;` so they apply
     atomically.
   - Enable RLS on every new table and add explicit policies — never leave a new
     table with RLS off or fully open.

3. Add a matching rollback file in `supabase/migrations/rollbacks/` with the
   **same filename**, reversing the change (drop what was created; restore prior
   definitions for policy/function edits). Corrective/security-fix migrations
   should carry a prominent warning in their rollback file.

---

## Testing migrations locally

```bash
# Start the local Supabase stack (Postgres, Studio, etc.).
supabase start

# Apply all pending migrations to the local DB.
supabase db reset          # rebuilds from scratch + runs every migration + seed
# or apply without wiping:
supabase migration up

# Inspect the result.
supabase db diff           # should show no drift after a clean apply
psql "$SUPABASE_DB_URL" -c "\dt public.*"
```

Verify:

- [ ] `supabase db reset` runs the full migration set with no errors.
- [ ] New tables have RLS enabled and the intended policies.
- [ ] The auto-generated types still compile:
      `npx supabase gen types typescript ... > src/integrations/supabase/types.ts`
      then `npm run typecheck`.

---

## Rollback procedures

1. **Back up first** (see `backup-procedures.md`): `npm run db:backup`.
2. Run the matching rollback script against the target database:

   ```bash
   psql "$SUPABASE_DB_URL" -f supabase/migrations/rollbacks/<timestamp>_name.sql
   ```

3. If multiple migrations must be undone, run the rollbacks in **reverse
   timestamp order** (newest first).
4. Re-verify the app and RLS after rolling back.

Notes:

- Rollbacks that drop tables are **destructive** — data is lost. The backup from
  step 1 is your recovery path.
- Some migrations are corrective security fixes; their rollback files warn that
  rolling back may reintroduce a vulnerability. Read the file header before
  running it.
- Prefer **rolling forward** (a new migration that supersedes the change) over
  rolling back in production when possible.

---

## Pre-migration checklist

Before applying a migration to **production**:

- [ ] Fresh backup taken (`npm run db:backup`) and verified restorable.
- [ ] Migration applied and tested locally via `supabase db reset`.
- [ ] A matching rollback script exists in `supabase/migrations/rollbacks/`.
- [ ] RLS enabled + policies present on any new table.
- [ ] Regenerated `src/integrations/supabase/types.ts` and `npm run typecheck`
      passes.
- [ ] `npm test -- --run` passes.
- [ ] Change reviewed; blast radius and downtime understood.
- [ ] Maintenance window / low-traffic time chosen for large or locking changes.

---

## Related

- `docs/database/backup-procedures.md`
- `supabase/migrations/rollbacks/`
- `scripts/db-backup.sh`
