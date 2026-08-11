import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const GENERATOR = 'scripts/generate-article-seed.mjs';
const MIGRATION = 'supabase/migrations/20260811000001_seed_crm_pillar_articles.sql';

/**
 * The seed migration is generated from content/crm/*.md, and the repo runs
 * Prettier over content/ on commit — which reflows the markdown after the
 * migration was generated from it. That has silently desynced the two twice
 * already, so the invariant is asserted here rather than remembered.
 *
 * If this fails: `node scripts/generate-article-seed.mjs > <migration>`.
 */
describe('article seed migration', () => {
  const generated = execFileSync('node', [GENERATOR], { encoding: 'utf8' });

  it('matches the committed migration', () => {
    expect(generated).toBe(readFileSync(MIGRATION, 'utf8'));
  });

  it('is idempotent — regenerating produces identical output', () => {
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
