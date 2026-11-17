import { describe, expect, it } from 'vitest';
// @ts-expect-error - plain .mjs script, no types
import { planImport, parseNote } from '../voice/import-story-bank.mjs';

const FOLDER = 'scripts/__tests__/fixtures/story-bank';
// The real key names come from the hub's Story Bank reader; these match the fixtures only.
const OPTS = {
  confirmedKey: 'status',
  confirmedValue: 'confirmed',
  tracksKey: 'tracks',
  productsKey: 'products',
};

describe('import-story-bank', () => {
  it('reads frontmatter and body', () => {
    expect(parseNote('---\nstatus: confirmed\n---\nBody here.\n')).toEqual({
      data: { status: 'confirmed' },
      body: 'Body here.',
    });
  });

  it('imports confirmed notes, skips and counts the rest', async () => {
    const plan = await planImport(FOLDER, OPTS);
    expect(plan.insert).toEqual([
      {
        body: 'A client asked for the export before the import.',
        tracks: ['platform'],
        products: [],
        confirmed: true,
        source: 'vault-import',
        source_ref: 'sub/export.md',
      },
      {
        body: 'Tried tacos tonight, ate the shell only.',
        tracks: ['eatpal'],
        products: ['eatpal'],
        confirmed: true,
        source: 'vault-import',
        source_ref: 'tacos.md',
      },
    ]);
    expect(plan.unconfirmed).toBe(1);
  });

  it('does not duplicate a note already imported', async () => {
    const plan = await planImport(FOLDER, OPTS, new Set(['tacos.md']));
    expect(plan.insert.map((s: { source_ref: string }) => s.source_ref)).toEqual(['sub/export.md']);
    expect(plan.alreadyImported).toBe(1);
  });
});
