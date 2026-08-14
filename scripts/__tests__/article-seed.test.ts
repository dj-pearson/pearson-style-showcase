import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const GENERATOR = 'scripts/generate-article-seed.mjs';
const MIGRATIONS_DIR = 'supabase/migrations';

/**
 * The newest generated seed migration. Resolved rather than hardcoded: the
 * generator always emits every article in content/crm, so adding an article
 * means writing a new migration, and a pinned filename would fail this test on
 * every content addition rather than on an actual desync. Earlier seed
 * migrations are history and are deliberately not re-checked - they have
 * already been applied.
 */
const MIGRATION = join(
  MIGRATIONS_DIR,
  readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d+_seed_crm_.*articles\.sql$/.test(name))
    .sort()
    .at(-1)!
);

/**
 * The seed migration is generated from content/crm/*.md, and the repo runs
 * Prettier over content/ on commit - which reflows the markdown after the
 * migration was generated from it. That has silently desynced the two twice
 * already, so the invariant is asserted here rather than remembered.
 *
 * If this fails: `node scripts/generate-article-seed.mjs > <migration>`.
 */
describe('article seed migration', () => {
  const generated = execFileSync('node', [GENERATOR], { encoding: 'utf8' });

  it('matches the committed migration', () => {
    // Compare on normalized newlines: git checks the .sql out as CRLF on
    // Windows while the generator writes LF, and the invariant being asserted
    // is the content, not the checkout's line endings.
    const lf = (s: string) => s.replace(/\r\n/g, '\n');

    expect(lf(generated)).toBe(lf(readFileSync(MIGRATION, 'utf8')));
  });

  it('is idempotent - regenerating produces identical output', () => {
    expect(execFileSync('node', [GENERATOR], { encoding: 'utf8' })).toBe(generated);
  });

  it('guards against duplicate rows on re-run', () => {
    expect(generated).toContain('WHERE NOT EXISTS');
  });

  it('seeds every article with the CRM category so the topic hub picks it up', () => {
    const slugCount = (generated.match(/^\s{4}'[a-z0-9-]+',$/gm) || []).length;
    const categoryCount = (generated.match(/^\s{4}'CRM',$/gm) || []).length;

    expect(slugCount).toBeGreaterThan(0);
    expect(categoryCount).toBe(slugCount);
  });

  it("includes the topic hub's configured pillar article", () => {
    // TopicHub.tsx sets pillarContent to this slug; a rename on one side only
    // would leave the hub pointing at nothing.
    expect(generated).toContain("'ai-crm-automation-complete-guide'");
  });
});
