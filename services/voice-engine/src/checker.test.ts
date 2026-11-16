import { describe, expect, it } from 'vitest';
import { check, checkWithRewrite, scanDraft } from './checker.js';
import { FakeLlm } from './llm.js';
import { draftFixture } from './testing/fixtures.js';
import { MemoryStore } from './testing/memory-store.js';
import { loadVoice } from './voice.js';

const voice = loadVoice();
const store = new MemoryStore();
const src = store.addSourceItem({
  product: 'eatpal',
  url: 'https://tryeatpal.com/a',
  body_text: 'EatPal sorts the log by texture.',
});
const ctx = { track: 'eatpal' as const, sourceItems: [src], stories: [] };
const supportedAudit = {
  claims: [
    {
      text: 'EatPal sorts the log by texture',
      kind: 'product',
      supported: true,
      source_item_id: src.id,
      story_id: null,
    },
  ],
};

describe('check', () => {
  it('passes a clean draft', async () => {
    const llm = new FakeLlm().enqueue(supportedAudit);
    const result = await check(
      { llm, voice, denyTerms: [] },
      draftFixture({ sourceId: src.id }),
      ctx
    );
    expect(result).toEqual({ ok: true, findings: [] });
  });

  it('fails a draft that asks "Agree?"', async () => {
    const llm = new FakeLlm().enqueue(supportedAudit);
    const draft = draftFixture({
      sourceId: src.id,
      linkedin: 'Write the list down and sort it by texture. Agree?',
    });
    const result = await check({ llm, voice, denyTerms: [] }, draft, ctx);
    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ kind: 'banned_pattern', where: 'copy.linkedin' })
    );
    expect(result.findings.map((f) => f.detail).join()).toContain('agree_q');
  });

  it('fails "my daughter now eats 14 foods" when no story backs it', async () => {
    const claim = 'My daughter now eats 14 foods since we started sorting by texture.';
    const llm = new FakeLlm().enqueue({
      claims: [
        {
          text: 'my daughter now eats 14 foods',
          kind: 'personal',
          supported: false,
          source_item_id: null,
          story_id: null,
        },
      ],
    });
    const result = await check(
      { llm, voice, denyTerms: [] },
      draftFixture({ sourceId: src.id, linkedin: claim }),
      ctx
    );
    expect(result.ok).toBe(false);
    expect(result.findings.map((f) => f.kind)).toEqual(
      expect.arrayContaining(['personal_without_story', 'unsourced_claim'])
    );
  });

  it('does not trust "supported: true" when the cited story is not on the post', async () => {
    const llm = new FakeLlm().enqueue({
      claims: [
        {
          text: 'my son ate the shell',
          kind: 'personal',
          supported: true,
          source_item_id: null,
          story_id: 'invented-id',
        },
      ],
    });
    const result = await check(
      { llm, voice, denyTerms: [] },
      draftFixture({ sourceId: src.id }),
      ctx
    );
    expect(result.findings).toContainEqual(expect.objectContaining({ kind: 'unsourced_claim' }));
  });

  it('does not accept a source page as backing for a personal claim', async () => {
    const llm = new FakeLlm().enqueue({
      claims: [
        {
          text: 'I tried this at dinner',
          kind: 'personal',
          supported: true,
          source_item_id: src.id,
          story_id: null,
        },
      ],
    });
    const result = await check(
      { llm, voice, denyTerms: [] },
      draftFixture({ sourceId: src.id }),
      ctx
    );
    expect(result.ok).toBe(false);
  });

  it('accepts a personal claim backed by a story on the post', async () => {
    const story = store.addStory({
      body: 'Tried tacos tonight, ate the shell only.',
      tracks: ['eatpal'],
    });
    const llm = new FakeLlm().enqueue({
      claims: [
        {
          text: 'ate the shell only',
          kind: 'personal',
          supported: true,
          source_item_id: null,
          story_id: story.id,
        },
      ],
    });
    const draft = draftFixture({
      sourceId: src.id,
      linkedin: 'Tacos tonight. My kid ate the shell only. That is texture talking.',
    });
    const result = await check({ llm, voice, denyTerms: [] }, draft, { ...ctx, stories: [story] });
    expect(result).toEqual({ ok: true, findings: [] });
  });
});

describe('scanDraft prices and deny terms', () => {
  it('fails any dollar amount', () => {
    const draft = draftFixture({ x: 'It costs $19 a month and pays for itself.' });
    expect(
      scanDraft({ voice, denyTerms: [] }, draft, { stories: [] }).map((f) => f.kind)
    ).toContain('price');
  });

  it('fails a deny term as a whole word, case-insensitive, and never echoes it', () => {
    const draft = draftFixture({ x: 'At my day job at initech we did it by hand.' });
    const findings = scanDraft({ voice, denyTerms: ['Initech'] }, draft, { stories: [] });
    const deny = findings.filter((f) => f.kind === 'deny_term');
    expect(deny).toHaveLength(1);
    expect(JSON.stringify(findings).toLowerCase()).not.toContain('initech');
  });

  it('does not match a deny term inside a longer word', () => {
    const draft = draftFixture({ x: 'Acmeville has a great thrift store.' });
    expect(
      scanDraft({ voice, denyTerms: ['Acme'] }, draft, { stories: [] }).filter(
        (f) => f.kind === 'deny_term'
      )
    ).toEqual([]);
  });
});

describe('checkWithRewrite', () => {
  it('sends a failing draft back once with the findings and accepts a clean rewrite', async () => {
    const llm = new FakeLlm().enqueue(supportedAudit, supportedAudit);
    const seen: string[][] = [];
    const result = await checkWithRewrite(
      { llm, voice, denyTerms: [] },
      draftFixture({ sourceId: src.id, linkedin: 'Sort it by texture. Thoughts?' }),
      ctx,
      async (findings) => {
        seen.push(findings);
        return draftFixture({ sourceId: src.id });
      }
    );
    expect(result).toMatchObject({ ok: true, rewrites: 1 });
    expect(seen[0]!.join()).toContain('thoughts_q');
  });

  it('gives up after the second failure with the reasons', async () => {
    const llm = new FakeLlm().enqueue(supportedAudit, supportedAudit);
    const bad = draftFixture({ sourceId: src.id, linkedin: 'Sort it by texture. Agree?' });
    const result = await checkWithRewrite({ llm, voice, denyTerms: [] }, bad, ctx, async () => bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join()).toContain('agree_q');
  });
});
