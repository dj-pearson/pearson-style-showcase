import * as z from 'zod/v4';
import { SkipError } from './errors.js';
import type { Llm } from './llm.js';
import { renderPrompt } from './prompts.js';
import type { Store } from './store.js';
import type { SourceItem, Story, Topic, TrackKey } from './types.js';
import type { Voice } from './voice.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const SOURCE_REUSE_DAYS = 30;
export const STORY_REUSE_DAYS = 60;
export const RECENT_TOPICS = 20;
/** The eatpal track carries a real story at least this many times in any 7 days, when stories are available. */
export const EATPAL_STORIES_PER_WEEK = 2;
/** How much of each page the picker sees. The writer gets the full text. */
const EXCERPT_CHARS = 1500;

const TopicWire = z.object({
  topic: z.string(),
  angle: z.string(),
  is_feature: z.boolean(),
  source_item_ids: z.array(z.string()),
  story_ids: z.array(z.string()),
});
type TopicChoice = z.infer<typeof TopicWire>;

export interface TopicCandidates {
  sourceItems: SourceItem[];
  stories: Story[];
  recent: Topic[];
  storyRequired: boolean;
}

export async function gatherCandidates(
  store: Store,
  track: TrackKey,
  product: string,
  now: Date
): Promise<TopicCandidates> {
  const sourceCutoff = new Date(now.getTime() - SOURCE_REUSE_DAYS * DAY_MS).toISOString();
  const storyCutoff = new Date(now.getTime() - STORY_REUSE_DAYS * DAY_MS).toISOString();

  const usedSourceIds = new Set(
    (await store.topicsSince(sourceCutoff)).flatMap((t) => t.source_item_ids)
  );
  const sourceItems = (await store.listSourceItems(product)).filter(
    (s) => !usedSourceIds.has(s.id)
  );

  const stories = (await store.listConfirmedStories()).filter(
    (s) =>
      (s.tracks.includes(track) || s.products.includes(product)) &&
      (!s.last_used_at || s.last_used_at < storyCutoff)
  );

  const recent = await store.recentTopics(track, RECENT_TOPICS);

  let storyRequired = false;
  if (track === 'eatpal' && stories.length > 0) {
    // Today plus the previous six days make the week. If those six days hold
    // fewer than two story posts, today has to be one.
    const sixDaysAgo = new Date(now.getTime() - 6 * DAY_MS).toISOString();
    const withStory = recent.filter(
      (t) => t.created_at >= sixDaysAgo && t.story_ids.length > 0
    ).length;
    storyRequired = withStory < EATPAL_STORIES_PER_WEEK;
  }

  return { sourceItems, stories, recent, storyRequired };
}

function problemsWith(choice: TopicChoice, c: TopicCandidates): string[] {
  const problems: string[] = [];
  const sourceIds = new Set(c.sourceItems.map((s) => s.id));
  const storyIds = new Set(c.stories.map((s) => s.id));
  const badSources = choice.source_item_ids.filter((id) => !sourceIds.has(id));
  const badStories = choice.story_ids.filter((id) => !storyIds.has(id));
  if (badSources.length)
    problems.push(`source_item_ids not in the candidate list: ${badSources.join(', ')}`);
  if (badStories.length)
    problems.push(`story_ids not in the candidate list: ${badStories.join(', ')}`);
  if (choice.source_item_ids.length + choice.story_ids.length === 0)
    problems.push('no source_item_ids or story_ids were chosen');
  if (c.storyRequired && choice.story_ids.length === 0)
    problems.push('this post must use at least one story_id');
  if (!choice.topic.trim()) problems.push('topic is empty');
  if (!choice.angle.trim()) problems.push('angle is empty');
  return problems;
}

export interface PickTopicDeps {
  store: Store;
  llm: Llm;
  voice: Voice;
  now?: () => Date;
}

/** Choose today's topic for a track, record it, and mark the stories it uses. */
export async function pickTopic(
  deps: PickTopicDeps,
  track: TrackKey,
  product: string
): Promise<Topic> {
  const now = (deps.now ?? (() => new Date()))();
  const c = await gatherCandidates(deps.store, track, product, now);
  if (c.sourceItems.length === 0 && c.stories.length === 0) {
    throw new SkipError(`no unused source pages or stories for ${product}`);
  }

  const system = renderPrompt('topic', {
    voice: deps.voice.forPrompt(track),
    story_requirement: c.storyRequired
      ? 'Today this track is due a real story: choose at least one `story_ids` entry and build the post around it.'
      : '',
  });
  const input = {
    track,
    product,
    source_items: c.sourceItems.map((s) => ({
      id: s.id,
      url: s.url,
      title: s.title,
      excerpt: s.body_text.slice(0, EXCERPT_CHARS),
    })),
    stories: c.stories.map((s) => ({ id: s.id, body: s.body })),
    recent_topics: c.recent.map((t) => ({ topic: t.topic, angle: t.angle })),
  };

  let problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const user =
      JSON.stringify(input, null, 2) +
      (problems.length
        ? `\n\nYour previous answer was rejected:\n- ${problems.join('\n- ')}\nAnswer again using only ids from the lists above.`
        : '');
    const choice = await deps.llm.json({
      label: 'topic',
      system,
      user,
      schema: TopicWire,
      effort: 'medium',
    });
    problems = problemsWith(choice, c);
    if (problems.length === 0) {
      const topic = await deps.store.insertTopic({
        track,
        product,
        topic: choice.topic.trim(),
        angle: choice.angle.trim(),
        is_feature: choice.is_feature,
        source_item_ids: [...new Set(choice.source_item_ids)],
        story_ids: [...new Set(choice.story_ids)],
      });
      await deps.store.bumpStories(topic.story_ids, now.toISOString());
      return topic;
    }
  }
  throw new Error(`topic picker returned an invalid choice twice: ${problems.join('; ')}`);
}
