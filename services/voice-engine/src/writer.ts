import * as z from 'zod/v4';
import { HARD_RULES } from './design.js';
import { SLIDE_BOUNDS } from './format.js';
import type { Llm } from './llm.js';
import { renderPrompt } from './prompts.js';
import type { Asset, Draft, Format, SourceItem, Story, Topic, TrackKey } from './types.js';
import type { Voice } from './voice.js';

/** Character limits per field. The platforms' own limits, minus nothing. */
export const LIMITS = {
  x: 280,
  threads: 500,
  linkedin: 3000,
  instagramCaption: 2200,
  instagramHashtags: 8,
  facebook: 5000,
  youtubeTitle: 100,
  youtubeDescription: 2000,
  slideHeadline: 90,
  slideBody: 220,
} as const;

/**
 * The shape asked of the API. Plain types only: lengths, counts and id
 * membership are checked by validateDraft below.
 */
const DraftWire = z.object({
  copy: z.object({
    x: z.string(),
    threads: z.string(),
    linkedin: z.string(),
    instagram: z.object({ caption: z.string(), hashtags: z.array(z.string()) }),
    facebook: z.string(),
    youtube: z.object({ title: z.string(), description: z.string() }),
  }),
  slides: z.array(
    z.object({
      role: z.enum(['hook', 'point', 'close', 'screen', 'single']),
      headline: z.string(),
      body: z.string().nullable(),
      asset_id: z.string().nullable(),
    })
  ),
  claims: z.array(
    z.object({
      text: z.string(),
      source_item_id: z.string().nullable(),
      story_id: z.string().nullable(),
    })
  ),
});

export interface WriteInput {
  track: TrackKey;
  product: string;
  topic: Topic;
  sourceItems: SourceItem[];
  stories: Story[];
  format: Format;
  /** Screenshot assets for this product; only used by product_carousel. */
  screenshots: Asset[];
  /** What the checker found wrong with the previous draft, when this is a rewrite. */
  findings?: string[];
}

const FORMAT_RULES: Record<Format, string> = {
  text_carousel: `A text carousel of ${SLIDE_BOUNDS.text_carousel.min} to ${SLIDE_BOUNDS.text_carousel.max} slides: one \`hook\` slide first (the claim or problem, headline only or with a short body), then 3 to 6 \`point\` slides (one idea each, headline plus body), then one \`close\` slide last (the takeaway in one line). Set \`asset_id\` to null on every slide.`,
  single_image:
    'A single image: exactly one slide with role `single`. Its headline is one sentence that holds the whole idea; body is null and `asset_id` is null.',
  product_carousel: `A product carousel of ${SLIDE_BOUNDS.product_carousel.min} to ${SLIDE_BOUNDS.product_carousel.max} slides: one \`hook\` slide first, then \`screen\` slides and optional \`point\` slides, then one \`close\` slide last. Each \`screen\` slide shows one of the real screenshots listed in the input: set its \`asset_id\` to that screenshot's id and write the headline as Dan's take on what the screen shows. Use at least two screen slides, each screenshot at most once, and only describe what the screenshot's caption and the source pages support.`,
};

/** Everything wrong with a draft's shape, as sentences the writer can act on. Empty means valid. */
export function validateDraft(
  draft: Draft,
  input: Pick<WriteInput, 'format' | 'sourceItems' | 'stories' | 'screenshots'>
): string[] {
  const p: string[] = [];
  const c = draft.copy;
  const over = (name: string, text: string, max: number) => {
    if (text.length > max) p.push(`${name} is ${text.length} characters; the limit is ${max}`);
  };
  const empty = (name: string, text: string) => {
    if (!text.trim()) p.push(`${name} is empty`);
  };
  over('copy.x', c.x, LIMITS.x);
  over('copy.threads', c.threads, LIMITS.threads);
  over('copy.linkedin', c.linkedin, LIMITS.linkedin);
  over('copy.instagram.caption', c.instagram.caption, LIMITS.instagramCaption);
  over('copy.facebook', c.facebook, LIMITS.facebook);
  over('copy.youtube.title', c.youtube.title, LIMITS.youtubeTitle);
  over('copy.youtube.description', c.youtube.description, LIMITS.youtubeDescription);
  empty('copy.x', c.x);
  empty('copy.threads', c.threads);
  empty('copy.linkedin', c.linkedin);
  empty('copy.instagram.caption', c.instagram.caption);
  empty('copy.facebook', c.facebook);
  empty('copy.youtube.title', c.youtube.title);
  empty('copy.youtube.description', c.youtube.description);
  if (c.instagram.hashtags.length > LIMITS.instagramHashtags) {
    p.push(
      `copy.instagram.hashtags has ${c.instagram.hashtags.length} entries; the limit is ${LIMITS.instagramHashtags}`
    );
  }
  for (const tag of c.instagram.hashtags) {
    if (!/^[\p{L}\p{N}_]+$/u.test(tag))
      p.push(`hashtag "${tag}" must be one word of letters and digits with no # sign`);
  }

  const { min, max } = SLIDE_BOUNDS[input.format];
  const n = draft.slides.length;
  if (n < min || n > max)
    p.push(`${input.format} needs ${min === max ? min : `${min} to ${max}`} slides; got ${n}`);
  draft.slides.forEach((s, i) => {
    empty(`slides[${i}].headline`, s.headline);
    over(`slides[${i}].headline`, s.headline, LIMITS.slideHeadline);
    if (s.body) over(`slides[${i}].body`, s.body, LIMITS.slideBody);
  });

  const roles = draft.slides.map((s) => s.role);
  if (input.format === 'single_image') {
    if (roles.some((r) => r !== 'single'))
      p.push('a single_image post has one slide with role "single"');
  } else if (n > 0) {
    if (roles[0] !== 'hook') p.push('the first slide must have role "hook"');
    if (roles[n - 1] !== 'close') p.push('the last slide must have role "close"');
    const middle = roles.slice(1, -1);
    const allowed = input.format === 'product_carousel' ? ['point', 'screen'] : ['point'];
    if (middle.some((r) => !allowed.includes(r)))
      p.push(`slides between the hook and the close must have role ${allowed.join(' or ')}`);
  }

  const shotIds = new Set(input.screenshots.map((a) => a.id));
  const screens = draft.slides.filter((s) => s.role === 'screen');
  if (input.format === 'product_carousel') {
    if (screens.length < 2) p.push('a product_carousel needs at least two "screen" slides');
    const seen = new Set<string>();
    for (const s of screens) {
      if (!s.asset_id || !shotIds.has(s.asset_id))
        p.push(`screen slide "${s.headline}" needs an asset_id from the screenshots list`);
      else if (seen.has(s.asset_id))
        p.push(`screenshot ${s.asset_id} is used on more than one slide`);
      else seen.add(s.asset_id);
    }
  }
  for (const s of draft.slides) {
    if (s.role !== 'screen' && s.asset_id)
      p.push(`only "screen" slides take an asset_id (slide "${s.headline}")`);
  }

  const sourceIds = new Set(input.sourceItems.map((s) => s.id));
  const storyIds = new Set(input.stories.map((s) => s.id));
  for (const claim of draft.claims) {
    if (claim.source_item_id && !sourceIds.has(claim.source_item_id))
      p.push(
        `claim "${claim.text}" cites source_item_id ${claim.source_item_id}, which is not in the input`
      );
    if (claim.story_id && !storyIds.has(claim.story_id))
      p.push(`claim "${claim.text}" cites story_id ${claim.story_id}, which is not in the input`);
    if (!claim.source_item_id && !claim.story_id)
      p.push(
        `claim "${claim.text}" has no source_item_id or story_id; remove the statement or cite what backs it`
      );
  }
  return p;
}

function normalize(wire: z.infer<typeof DraftWire>): Draft {
  return {
    copy: {
      ...wire.copy,
      instagram: {
        caption: wire.copy.instagram.caption,
        hashtags: wire.copy.instagram.hashtags
          .map((h) => h.replace(/^#+/, '').trim())
          .filter(Boolean),
      },
    },
    slides: wire.slides.map((s) => ({
      role: s.role,
      headline: s.headline.trim(),
      ...(s.body?.trim() ? { body: s.body.trim() } : {}),
      ...(s.asset_id ? { asset_id: s.asset_id } : {}),
    })),
    claims: wire.claims,
  };
}

export interface WriterDeps {
  llm: Llm;
  voice: Voice;
}

/**
 * One Claude call turns the topic into per-platform copy, slide text and a
 * claims list. A draft that breaks a limit gets one corrective re-ask; a
 * second miss fails the stage.
 */
export async function write(deps: WriterDeps, input: WriteInput): Promise<Draft> {
  const system = renderPrompt('write', {
    hard_rules: HARD_RULES,
    voice: deps.voice.forPrompt(input.track),
    format: input.format,
    format_rules: FORMAT_RULES[input.format],
    findings: input.findings?.length
      ? `## This is a rewrite\n\nThe previous draft was stopped by the checker. Fix every item below. Where a statement could not be backed, take it out; do not swap in a different unsupported detail.\n\n- ${input.findings.join('\n- ')}`
      : '',
  });
  const payload = {
    track: input.track,
    product: input.product,
    topic: input.topic.topic,
    angle: input.topic.angle,
    source_items: input.sourceItems.map((s) => ({
      id: s.id,
      url: s.url,
      title: s.title,
      text: s.body_text,
    })),
    stories: input.stories.map((s) => ({ id: s.id, body: s.body })),
    screenshots:
      input.format === 'product_carousel'
        ? input.screenshots.map((a) => ({ id: a.id, caption: a.caption }))
        : [],
  };

  let problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const user =
      JSON.stringify(payload, null, 2) +
      (problems.length
        ? `\n\nYour previous draft was rejected for these reasons. Write the whole post again with each one fixed:\n- ${problems.join('\n- ')}`
        : '');
    const wire = await deps.llm.json({
      label: 'write',
      system,
      user,
      schema: DraftWire,
      effort: 'high',
    });
    const draft = normalize(wire);
    problems = validateDraft(draft, input);
    if (problems.length === 0) return draft;
  }
  throw new Error(`writer returned an invalid draft twice: ${problems.slice(0, 5).join('; ')}`);
}
