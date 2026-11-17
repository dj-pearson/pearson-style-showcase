import type { Draft, Topic } from '../types.js';

export function topicFixture(partial: Partial<Topic> = {}): Topic {
  return {
    id: 'topic-1',
    track: 'eatpal',
    product: 'eatpal',
    topic: 'The safe foods list sorts by texture',
    angle: 'Texture tells you the next food to try',
    is_feature: false,
    source_item_ids: [],
    story_ids: [],
    created_at: '2026-11-17T18:00:00.000Z',
    ...partial,
  };
}

/** A wire-shaped draft (nullable body/asset_id), clean by default. */
export function wireDraft(
  over: {
    sourceId?: string;
    storyId?: string;
    x?: string;
    linkedin?: string;
    slides?: unknown[];
    claims?: unknown[];
  } = {}
) {
  const sourceId = over.sourceId ?? 'src-1';
  return {
    copy: {
      x:
        over.x ??
        'Write the safe foods list down. Texture is the pattern, and it tells you which food is one small step away.',
      threads:
        'Write the safe foods list down. Sort it by texture. The next food to try is the one that sits closest to what is already on the list.',
      linkedin:
        over.linkedin ??
        'A safe foods list is every food your child eats without a fight, written down in one place.\n\nSort it by texture and the next step shows up on its own.',
      instagram: {
        caption: 'Texture first. The list does the rest.',
        hashtags: ['pickyeater', '#ARFID'],
      },
      facebook:
        'Write the safe foods list down and sort it by texture. The next food to try is the closest one.',
      youtube: {
        title: 'Sort the safe foods list by texture',
        description: 'Why texture is the pattern. How the list shows the next step.',
      },
    },
    slides: over.slides ?? [
      { role: 'hook', headline: 'Your safe foods list has a pattern', body: null, asset_id: null },
      {
        role: 'point',
        headline: 'Write every safe food down',
        body: 'One place, not your memory.',
        asset_id: null,
      },
      {
        role: 'point',
        headline: 'Sort it by texture',
        body: 'Crunchy and dry. Smooth and cold.',
        asset_id: null,
      },
      {
        role: 'point',
        headline: 'Look one step out',
        body: 'The next food is the closest texture.',
        asset_id: null,
      },
      {
        role: 'close',
        headline: 'Texture first. The list does the rest.',
        body: null,
        asset_id: null,
      },
    ],
    claims: over.claims ?? [
      { text: 'EatPal sorts the log by texture', source_item_id: sourceId, story_id: null },
    ],
  };
}

/** The same draft in engine shape. */
export function draftFixture(over: Parameters<typeof wireDraft>[0] = {}): Draft {
  const w = wireDraft(over);
  return {
    copy: {
      ...w.copy,
      instagram: { caption: w.copy.instagram.caption, hashtags: ['pickyeater', 'ARFID'] },
    },
    slides: (
      w.slides as {
        role: Draft['slides'][number]['role'];
        headline: string;
        body: string | null;
        asset_id: string | null;
      }[]
    ).map((s) => ({
      role: s.role,
      headline: s.headline,
      ...(s.body ? { body: s.body } : {}),
      ...(s.asset_id ? { asset_id: s.asset_id } : {}),
    })),
    claims: w.claims as Draft['claims'],
  };
}
