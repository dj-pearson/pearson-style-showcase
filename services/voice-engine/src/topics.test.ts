import { describe, expect, it } from 'vitest';
import { SkipError } from './errors.js';
import { FakeLlm } from './llm.js';
import { MemoryStore } from './testing/memory-store.js';
import { gatherCandidates, pickTopic } from './topics.js';
import { loadVoice } from './voice.js';

const voice = loadVoice();
const NOW = new Date('2026-11-17T18:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function setup() {
  const store = new MemoryStore();
  store.now = () => NOW;
  const llm = new FakeLlm();
  return { store, llm, deps: { store, llm, voice, now: () => NOW } };
}

describe('gatherCandidates', () => {
  it('excludes source pages used in the last 30 days and stories used in the last 60', async () => {
    const { store } = setup();
    const fresh = store.addSourceItem({ product: 'eatpal', url: 'https://tryeatpal.com/a' });
    const usedRecently = store.addSourceItem({ product: 'eatpal', url: 'https://tryeatpal.com/b' });
    const usedLongAgo = store.addSourceItem({ product: 'eatpal', url: 'https://tryeatpal.com/c' });
    store.addSourceItem({ product: 'brikly', url: 'https://brikly.net/x' });
    store.topics.push(
      {
        id: 't1',
        track: 'eatpal',
        product: 'eatpal',
        topic: 'b',
        angle: 'b',
        is_feature: false,
        source_item_ids: [usedRecently.id],
        story_ids: [],
        created_at: daysAgo(29),
      },
      {
        id: 't2',
        track: 'eatpal',
        product: 'eatpal',
        topic: 'c',
        angle: 'c',
        is_feature: false,
        source_item_ids: [usedLongAgo.id],
        story_ids: [],
        created_at: daysAgo(31),
      }
    );
    const neverUsed = store.addStory({ body: 'ate the taco shell only', tracks: ['eatpal'] });
    store.addStory({ body: 'used last month', tracks: ['eatpal'], last_used_at: daysAgo(59) });
    const usedLong = store.addStory({
      body: 'used in the summer',
      products: ['eatpal'],
      last_used_at: daysAgo(61),
    });
    store.addStory({ body: 'not confirmed', tracks: ['eatpal'], confirmed: false });
    store.addStory({ body: 'another track', tracks: ['platform'] });

    const c = await gatherCandidates(store, 'eatpal', 'eatpal', NOW);
    expect(c.sourceItems.map((s) => s.id).sort()).toEqual([fresh.id, usedLongAgo.id].sort());
    expect(c.stories.map((s) => s.id).sort()).toEqual([neverUsed.id, usedLong.id].sort());
  });

  it('requires a story on eatpal until the week holds two, and never on the other tracks', async () => {
    const { store } = setup();
    const src = store.addSourceItem({ product: 'eatpal', url: 'https://tryeatpal.com/a' });
    store.addStory({ body: 'ate the taco shell only', tracks: ['eatpal', 'gradethread'] });
    const withStory = (id: string, age: number) =>
      store.topics.push({
        id,
        track: 'eatpal',
        product: 'eatpal',
        topic: id,
        angle: id,
        is_feature: false,
        source_item_ids: [],
        story_ids: ['some-story'],
        created_at: daysAgo(age),
      });

    expect((await gatherCandidates(store, 'eatpal', 'eatpal', NOW)).storyRequired).toBe(true);
    withStory('s1', 2);
    expect((await gatherCandidates(store, 'eatpal', 'eatpal', NOW)).storyRequired).toBe(true);
    withStory('s2', 5);
    expect((await gatherCandidates(store, 'eatpal', 'eatpal', NOW)).storyRequired).toBe(false);
    // A story post from eight days ago is outside the week and does not count.
    store.topics = store.topics.filter((t) => t.id !== 's2');
    withStory('s3', 8);
    expect((await gatherCandidates(store, 'eatpal', 'eatpal', NOW)).storyRequired).toBe(true);

    store.addSourceItem({ product: 'gradethread', url: 'https://gradethread.com/a' });
    expect((await gatherCandidates(store, 'gradethread', 'gradethread', NOW)).storyRequired).toBe(
      false
    );
    expect(src.id).toBeTruthy();
  });

  it('does not require a story when none is eligible', async () => {
    const { store } = setup();
    store.addSourceItem({ product: 'eatpal', url: 'https://tryeatpal.com/a' });
    store.addStory({ body: 'used last week', tracks: ['eatpal'], last_used_at: daysAgo(7) });
    expect((await gatherCandidates(store, 'eatpal', 'eatpal', NOW)).storyRequired).toBe(false);
  });
});

describe('pickTopic', () => {
  it('records the topic and bumps the stories it uses', async () => {
    const { store, llm, deps } = setup();
    const src = store.addSourceItem({ product: 'eatpal', url: 'https://tryeatpal.com/a' });
    const story = store.addStory({ body: 'ate the taco shell only', tracks: ['eatpal'] });
    llm.enqueue({
      topic: 'Texture first',
      angle: 'The shell is the clue',
      is_feature: false,
      source_item_ids: [src.id],
      story_ids: [story.id],
    });

    const topic = await pickTopic(deps, 'eatpal', 'eatpal');
    expect(topic).toMatchObject({
      track: 'eatpal',
      product: 'eatpal',
      topic: 'Texture first',
      is_feature: false,
    });
    expect(store.topics).toHaveLength(1);
    expect(store.stories[0]).toMatchObject({ times_used: 1, last_used_at: NOW.toISOString() });
    expect(llm.calls[0]!.system).toContain('due a real story');
  });

  it('rejects ids that were not candidates, asks once more, and accepts a valid second answer', async () => {
    const { store, llm, deps } = setup();
    const src = store.addSourceItem({ product: 'gradethread', url: 'https://gradethread.com/a' });
    llm.enqueue(
      {
        topic: 'Grading',
        angle: 'x',
        is_feature: true,
        source_item_ids: ['made-up-id'],
        story_ids: [],
      },
      { topic: 'Grading', angle: 'x', is_feature: true, source_item_ids: [src.id], story_ids: [] }
    );
    const topic = await pickTopic(deps, 'gradethread', 'gradethread');
    expect(topic.source_item_ids).toEqual([src.id]);
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[1]!.user).toContain('made-up-id');
    expect(llm.calls[1]!.user).toContain('previous answer was rejected');
  });

  it('fails after two invalid answers and records nothing', async () => {
    const { store, llm, deps } = setup();
    store.addSourceItem({ product: 'gradethread', url: 'https://gradethread.com/a' });
    const bad = {
      topic: 'Grading',
      angle: 'x',
      is_feature: false,
      source_item_ids: ['nope'],
      story_ids: [],
    };
    llm.enqueue(bad, bad);
    await expect(pickTopic(deps, 'gradethread', 'gradethread')).rejects.toThrow(
      /invalid choice twice/
    );
    expect(store.topics).toHaveLength(0);
  });

  it('rejects an eatpal choice with no story when one is due', async () => {
    const { store, llm, deps } = setup();
    const src = store.addSourceItem({ product: 'eatpal', url: 'https://tryeatpal.com/a' });
    const story = store.addStory({ body: 'ate the taco shell only', tracks: ['eatpal'] });
    llm.enqueue(
      { topic: 'Lists', angle: 'x', is_feature: false, source_item_ids: [src.id], story_ids: [] },
      {
        topic: 'Lists',
        angle: 'x',
        is_feature: false,
        source_item_ids: [src.id],
        story_ids: [story.id],
      }
    );
    const topic = await pickTopic(deps, 'eatpal', 'eatpal');
    expect(topic.story_ids).toEqual([story.id]);
    expect(llm.calls[1]!.user).toContain('must use at least one story_id');
  });

  it('skips the day when there is nothing to write from', async () => {
    const { llm, deps } = setup();
    await expect(pickTopic(deps, 'platform', 'brikly')).rejects.toBeInstanceOf(SkipError);
    expect(llm.calls).toHaveLength(0);
  });
});
