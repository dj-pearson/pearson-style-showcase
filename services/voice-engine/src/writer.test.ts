import { describe, expect, it } from 'vitest';
import { FakeLlm, LlmError } from './llm.js';
import { MemoryStore } from './testing/memory-store.js';
import { topicFixture, wireDraft } from './testing/fixtures.js';
import { validateDraft, write, type WriteInput } from './writer.js';
import { loadVoice } from './voice.js';

const voice = loadVoice();
const store = new MemoryStore();
const src = store.addSourceItem({
  product: 'eatpal',
  url: 'https://tryeatpal.com/blog/safe-foods-list',
  body_text: 'EatPal sorts the log by texture and color.',
});

const input = (over: Partial<WriteInput> = {}): WriteInput => ({
  track: 'eatpal',
  product: 'eatpal',
  topic: topicFixture({ source_item_ids: [src.id] }),
  sourceItems: [src],
  stories: [],
  format: 'text_carousel',
  screenshots: [],
  ...over,
});

describe('write', () => {
  it('returns a normalised draft and states the hard rules in the prompt', async () => {
    const llm = new FakeLlm().enqueue(wireDraft({ sourceId: src.id }));
    const draft = await write({ llm, voice }, input());
    expect(draft.copy.instagram.hashtags).toEqual(['pickyeater', 'ARFID']);
    expect(draft.slides[0]).toEqual({
      role: 'hook',
      headline: 'Your safe foods list has a pattern',
    });
    expect(llm.calls[0]!.system).toContain('**No invented claims.**');
    expect(llm.calls[0]!.system).toContain('Never double-post.');
    expect(llm.calls[0]!.user).toContain('EatPal sorts the log by texture and color.');
  });

  it('re-asks once when a field is over length, quoting the limit', async () => {
    const longX = 'x'.repeat(300);
    const llm = new FakeLlm().enqueue(
      wireDraft({ sourceId: src.id, x: longX }),
      wireDraft({ sourceId: src.id })
    );
    const draft = await write({ llm, voice }, input());
    expect(draft.copy.x.length).toBeLessThanOrEqual(280);
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[1]!.user).toContain('copy.x is 300 characters; the limit is 280');
  });

  it('fails the stage when the re-ask is still over length', async () => {
    const bad = wireDraft({ sourceId: src.id, linkedin: 'y'.repeat(3001) });
    const llm = new FakeLlm().enqueue(bad, bad);
    await expect(write({ llm, voice }, input())).rejects.toThrow(
      /invalid draft twice.*linkedin is 3001/
    );
  });

  it('treats a response that does not match the schema as an error', async () => {
    const llm = new FakeLlm().enqueue({ copy: { x: 'only x' }, slides: [], claims: [] });
    await expect(write({ llm, voice }, input())).rejects.toBeInstanceOf(LlmError);
  });

  it('carries the checker findings into a rewrite', async () => {
    const llm = new FakeLlm().enqueue(wireDraft({ sourceId: src.id }));
    await write({ llm, voice }, input({ findings: ['copy.x: agree_q: Bait question.'] }));
    expect(llm.calls[0]!.system).toContain('This is a rewrite');
    expect(llm.calls[0]!.system).toContain('agree_q');
  });
});

describe('validateDraft', () => {
  const base = { sourceItems: [src], stories: [], screenshots: [] };
  const toDraft = (w: ReturnType<typeof wireDraft>) => ({
    ...w,
    copy: {
      ...w.copy,
      instagram: {
        ...w.copy.instagram,
        hashtags: w.copy.instagram.hashtags.map((h) => h.replace(/^#/, '')),
      },
    },
    slides: w.slides.map((s) => {
      const x = s as {
        role: 'hook';
        headline: string;
        body: string | null;
        asset_id: string | null;
      };
      return {
        role: x.role,
        headline: x.headline,
        ...(x.body ? { body: x.body } : {}),
        ...(x.asset_id ? { asset_id: x.asset_id } : {}),
      };
    }),
    claims: w.claims as { text: string; source_item_id: string | null; story_id: null }[],
  });

  it('accepts the clean fixture', () => {
    expect(
      validateDraft(toDraft(wireDraft({ sourceId: src.id })), { ...base, format: 'text_carousel' })
    ).toEqual([]);
  });

  it('sizes slides to the format', () => {
    const one = toDraft(
      wireDraft({
        sourceId: src.id,
        slides: [{ role: 'single', headline: 'One line.', body: null, asset_id: null }],
      })
    );
    expect(validateDraft(one, { ...base, format: 'single_image' })).toEqual([]);
    expect(validateDraft(one, { ...base, format: 'text_carousel' }).join()).toContain(
      'needs 5 to 8 slides; got 1'
    );
  });

  it('requires real screenshot ids on screen slides of a product carousel', () => {
    const shot = {
      id: 'shot-1',
      kind: 'screenshot' as const,
      product: 'eatpal',
      storage_path: 's.png',
      caption: 'Safe foods list',
    };
    const slides = [
      { role: 'hook', headline: 'Hook', body: null, asset_id: null },
      { role: 'screen', headline: 'The list', body: null, asset_id: 'shot-1' },
      { role: 'screen', headline: 'Made up', body: null, asset_id: 'not-a-shot' },
      { role: 'close', headline: 'Close', body: null, asset_id: null },
    ];
    const problems = validateDraft(toDraft(wireDraft({ sourceId: src.id, slides })), {
      ...base,
      screenshots: [shot],
      format: 'product_carousel',
    });
    expect(problems.join()).toContain('needs an asset_id from the screenshots list');
  });

  it('rejects claims that cite ids outside the input or cite nothing', () => {
    const claims = [
      { text: 'a', source_item_id: 'elsewhere', story_id: null },
      { text: 'b', source_item_id: null, story_id: null },
    ];
    const problems = validateDraft(toDraft(wireDraft({ sourceId: src.id, claims })), {
      ...base,
      format: 'text_carousel',
    });
    expect(problems.join('\n')).toMatch(/cites source_item_id elsewhere/);
    expect(problems.join('\n')).toMatch(/claim "b" has no source_item_id or story_id/);
  });
});
