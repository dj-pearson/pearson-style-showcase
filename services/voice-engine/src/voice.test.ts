import { describe, expect, it } from 'vitest';
import { loadVoice, parseVoiceGuide } from './voice.js';

const voice = loadVoice();

/** Patterns the PRD names; each must exist in the guide by id. */
const REQUIRED = [
  'agree_q',
  'thoughts_q',
  'comment_below',
  'follow_for_more',
  'like_if',
  'let_that_sink_in',
  'unpopular_opinion',
  'nobody_talks_about',
  'heres_the_thing',
  'thread_emoji',
  'point_down_emoji',
  'fire_bait',
  'a_thread',
  'save_this_post',
  'tag_someone',
  'drop_a',
  'ends_with_question',
];

describe('voice guide', () => {
  it('has a speaker for each of the three tracks', () => {
    expect(voice.track('eatpal').speaker).toMatch(/parent of a picky eater/i);
    expect(voice.track('eatpal').speaker).toMatch(/personal-training/i);
    expect(voice.track('gradethread').speaker).toMatch(/built GradeThread and FlipDesk/);
    expect(voice.track('platform').speaker).toMatch(/salesman who builds the software/i);
  });

  it('carries every banned pattern the PRD names', () => {
    const ids = voice.guide.bannedPatterns.map((b) => b.id);
    for (const id of REQUIRED) expect(ids).toContain(id);
  });

  it('states the five rules', () => {
    expect(voice.guide.rules.map((r) => r.id)).toEqual([
      'personal_needs_story',
      'product_needs_source',
      'no_employer',
      'no_prices',
      'no_default_question',
    ]);
  });

  it('rejects a guide with a missing track', () => {
    const { platform: _p, ...tracks } = voice.guide.tracks;
    expect(() => parseVoiceGuide({ ...voice.guide, tracks })).toThrow(/voice guide is invalid/);
  });

  it('rejects a pattern that is not a valid regex', () => {
    const bad = [{ ...voice.guide.bannedPatterns[0]!, pattern: '(' }];
    expect(() => parseVoiceGuide({ ...voice.guide, bannedPatterns: bad })).toThrow();
  });
});

describe('scanBanned', () => {
  for (const rule of voice.guide.bannedPatterns) {
    it(`${rule.id} fires on its hit example`, () => {
      expect(voice.scanBanned(rule.hit, 'body')).toContain(rule.id);
    });
    it(`${rule.id} stays quiet on its miss example`, () => {
      expect(voice.scanBanned(rule.miss, 'body')).not.toContain(rule.id);
    });
  }

  it('returns nothing for a clean post', () => {
    expect(
      voice.scanBanned(
        'I price the jacket after I grade it, never before. The grade sets the ceiling.'
      )
    ).toEqual([]);
  });

  it('lets a slide headline be a question, and still blocks a post that ends on one', () => {
    const q = 'Why does the shell get eaten and the filling left?';
    expect(voice.scanBanned(q, 'all')).not.toContain('ends_with_question');
    expect(voice.scanBanned(q, 'body')).toContain('ends_with_question');
  });

  it('finds neverSays phrases as whole words only', () => {
    expect(voice.scanNeverSays('This is a game-changer for resellers.')).toContain('game-changer');
    expect(voice.scanNeverSays('He hacked at the hedge.')).not.toContain('hack');
    expect(voice.scanNeverSays('One quick hack for labels.')).toContain('hack');
  });
});
