import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const GENERATOR = 'scripts/generate-article-content-update.mjs';
const NAME = '20261116000300_update_crm_article_content.sql';
const MIGRATION = join('supabase', 'migrations', NAME);
const ROLLBACK = join('supabase', 'migrations', 'rollbacks', NAME);
const SNAPSHOT = join('scripts', 'data', 'crm-seeded-articles.json');

const lf = (s: string) => s.replace(/\r\n/g, '\n');
const generate = (mode: string) => execFileSync('node', [GENERATOR, mode], { encoding: 'utf8' });

const slugs = readdirSync('content/crm')
  .filter((name) => name.endsWith('.md'))
  .map((name) => {
    const slug = readFileSync(join('content/crm', name), 'utf8').match(
      /^slug:\s*['"]?([a-z0-9-]+)/m
    )?.[1];
    if (!slug) throw new Error(`${name}: no slug`);
    return slug;
  });

/**
 * The migration pushes content/crm edits into rows the seeds already inserted.
 * If the markdown changes again without a new migration, this fails: either
 * regenerate into a NEW migration (this one may already be applied) and point
 * NAME at it, or revert the markdown.
 */
describe('CRM article content update migration', () => {
  const migration = generate('migration');
  const rollback = generate('rollback');

  it('matches the committed migration', () => {
    expect(lf(migration)).toBe(lf(readFileSync(MIGRATION, 'utf8')));
  });

  it('matches the committed rollback', () => {
    expect(lf(rollback)).toBe(lf(readFileSync(ROLLBACK, 'utf8')));
  });

  it('runs after every CRM seed migration', () => {
    const seeds = readdirSync(join('supabase', 'migrations')).filter((n) =>
      /^\d+_seed_crm_/.test(n)
    );
    expect(seeds.length).toBeGreaterThan(0);
    for (const seed of seeds) expect(seed < NAME).toBe(true);
  });

  it('covers every article in content/crm, in both directions', () => {
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      expect(migration).toContain(`'${slug}',`);
      expect(rollback).toContain(`'${slug}',`);
    }
    const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
    expect(Object.keys(snapshot.articles).sort()).toEqual([...slugs].sort());
  });

  it('only updates rows whose current values match a known version', () => {
    for (const sql of [migration, rollback]) {
      expect(sql).toContain('= ANY (r.from_fingerprints)');
      expect(sql).toContain('GET DIAGNOSTICS n = ROW_COUNT');
      expect(sql).toContain("RAISE NOTICE 'CRM articles skipped, edited since seeding: %'");
    }
  });

  it('keeps the SQL around the article bodies ASCII', () => {
    for (const sql of [migration, rollback]) {
      const outsideBodies = sql
        .split('$crm_md$')
        .filter((_, i) => i % 2 === 0)
        .join('');
      // eslint-disable-next-line no-control-regex
      expect(outsideBodies).toMatch(/^[\x00-\x7f]*$/);
    }
  });
});
