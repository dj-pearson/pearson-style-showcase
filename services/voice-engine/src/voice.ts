import { readFileSync } from 'node:fs';
import * as z from 'zod/v4';
import { VOICE_FILE } from './paths.js';
import { TRACKS, type TrackKey } from './types.js';

/**
 * The voice guide is data (voice/danpearson.voice.json). This module loads it,
 * checks its shape, and runs the banned-pattern scan the checker relies on.
 */

const TrackVoice = z.object({
  speaker: z.string().min(1),
  audience: z.string().min(1),
  register: z.string().min(1),
});

const BannedPattern = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  pattern: z.string().min(1),
  flags: z.string().regex(/^[imsu]*$/),
  /** 'all' scans every field. 'body' skips slide text and titles, where a question can be a fair hook. */
  scope: z.enum(['all', 'body']),
  why: z.string().min(1),
  /** One example the pattern must match and one it must not. The tests run both. */
  hit: z.string().min(1),
  miss: z.string().min(1),
});

const VoiceGuideSchema = z.object({
  comment: z.string(),
  sourceCommit: z.string().nullable(),
  speaker: z.string().min(1),
  person: z.string().min(1),
  notes: z.array(z.string().min(1)).min(1),
  says: z.array(z.string().min(1)),
  neverSays: z.array(z.string().min(1)).min(1),
  anonymity: z.array(z.string().min(1)).min(1),
  rules: z.array(z.object({ id: z.string().min(1), rule: z.string().min(1) })).min(1),
  tracks: z.object({ gradethread: TrackVoice, eatpal: TrackVoice, platform: TrackVoice }),
  bannedPatterns: z.array(BannedPattern).min(1),
});

export type VoiceGuide = z.infer<typeof VoiceGuideSchema>;
export type BannedPatternRule = z.infer<typeof BannedPattern>;
export type ScanScope = 'all' | 'body';

interface Compiled {
  rule: BannedPatternRule;
  re: RegExp;
}

export class Voice {
  private readonly compiled: Compiled[];

  constructor(public readonly guide: VoiceGuide) {
    const ids = new Set<string>();
    this.compiled = guide.bannedPatterns.map((rule) => {
      if (ids.has(rule.id))
        throw new Error(`voice guide: duplicate bannedPatterns id "${rule.id}"`);
      ids.add(rule.id);
      // No g flag: test() on a global regex is stateful.
      return { rule, re: new RegExp(rule.pattern, rule.flags) };
    });
    for (const t of TRACKS)
      if (!guide.tracks[t]) throw new Error(`voice guide: missing track "${t}"`);
  }

  /**
   * Ids of every banned pattern the text matches. `scope` says what kind of
   * field the text came from: body-scoped rules only fire on post bodies.
   */
  scanBanned(text: string, scope: ScanScope = 'body'): string[] {
    const hits: string[] = [];
    for (const { rule, re } of this.compiled) {
      if (rule.scope === 'body' && scope !== 'body') continue;
      if (re.test(text)) hits.push(rule.id);
    }
    return hits;
  }

  /** neverSays entries found in the text, case-insensitive. */
  scanNeverSays(text: string): string[] {
    const lower = text.toLowerCase();
    return this.guide.neverSays.filter((phrase) => {
      const p = phrase.toLowerCase();
      const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(lower);
    });
  }

  track(key: TrackKey) {
    return this.guide.tracks[key];
  }

  /** The guide as the writer and auditor see it: everything except the test examples. */
  forPrompt(key: TrackKey): string {
    const g = this.guide;
    const t = g.tracks[key];
    return JSON.stringify(
      {
        speaker: g.speaker,
        person: g.person,
        track: { key, ...t },
        notes: g.notes,
        says: g.says,
        neverSays: g.neverSays,
        anonymity: g.anonymity,
        rules: g.rules.map((r) => r.rule),
        bannedPatterns: g.bannedPatterns.map((b) => ({ example: b.hit, why: b.why })),
      },
      null,
      2
    );
  }
}

export function parseVoiceGuide(raw: unknown): Voice {
  const parsed = VoiceGuideSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`voice guide is invalid: ${z.prettifyError(parsed.error)}`);
  }
  return new Voice(parsed.data);
}

export function loadVoice(file: string = VOICE_FILE): Voice {
  return parseVoiceGuide(JSON.parse(readFileSync(file, 'utf8')));
}
