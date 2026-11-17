import * as z from 'zod/v4';
import type { Llm } from './llm.js';
import { renderPrompt } from './prompts.js';
import { draftTexts, type Draft, type SourceItem, type Story, type TrackKey } from './types.js';
import type { Voice } from './voice.js';

export type FindingKind =
  | 'banned_pattern'
  | 'never_says'
  | 'price'
  | 'deny_term'
  | 'unsourced_claim'
  | 'personal_without_story';

export interface Finding {
  kind: FindingKind;
  /** Which field: copy.x, slides[2].headline, ... */
  where: string;
  /** What is wrong, safe to log, store and show to the writer. Never contains a deny term. */
  detail: string;
}

export interface CheckResult {
  ok: boolean;
  findings: Finding[];
}

export interface CheckContext {
  track: TrackKey;
  sourceItems: SourceItem[];
  stories: Story[];
}

export interface CheckerDeps {
  llm: Llm;
  voice: Voice;
  /** Names that must never appear in a post. Used for matching only. */
  denyTerms: string[];
}

const AuditWire = z.object({
  claims: z.array(
    z.object({
      text: z.string(),
      kind: z.enum(['personal', 'product', 'statistic']),
      supported: z.boolean(),
      source_item_id: z.string().nullable(),
      story_id: z.string().nullable(),
    })
  ),
});

const PRICE = /\$\s?\d|\b\d+(?:[.,]\d+)?\s?(?:dollars|bucks|USD)\b|\bUSD\s?\d/i;

/**
 * First-person statements about the people in Dan's life. With no story on
 * the post there is nothing that could back one, so this fails without asking
 * the model. It is a backstop for the audit, which catches the general case.
 */
const PERSONAL =
  /\bmy (daughter|son|kid|kids|child|children|wife|family|toddler|client|clients|customer|customers)\b/i;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The deterministic part of the check: no model call. */
export function scanDraft(
  deps: Pick<CheckerDeps, 'voice' | 'denyTerms'>,
  draft: Draft,
  ctx: Pick<CheckContext, 'stories'>
): Finding[] {
  const findings: Finding[] = [];
  const denyRes = deps.denyTerms.map(
    (t) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(t)}($|[^\\p{L}\\p{N}])`, 'iu')
  );
  const bodyFields = new Set([
    'copy.x',
    'copy.threads',
    'copy.linkedin',
    'copy.instagram.caption',
    'copy.facebook',
    'copy.youtube.description',
  ]);

  for (const { where, text } of draftTexts(draft)) {
    const scope = bodyFields.has(where) ? 'body' : 'all';
    for (const id of deps.voice.scanBanned(text, scope)) {
      const rule = deps.voice.guide.bannedPatterns.find((b) => b.id === id)!;
      findings.push({ kind: 'banned_pattern', where, detail: `${id}: ${rule.why}` });
    }
    for (const phrase of deps.voice.scanNeverSays(text)) {
      findings.push({
        kind: 'never_says',
        where,
        detail: `uses "${phrase}", which Dan never says`,
      });
    }
    if (PRICE.test(text))
      findings.push({ kind: 'price', where, detail: 'contains a price or dollar amount' });
    if (denyRes.some((re) => re.test(text))) {
      // The term itself is deliberately left out: findings are logged and stored.
      findings.push({
        kind: 'deny_term',
        where,
        detail: 'names something on the deny list (for example the employer)',
      });
    }
    if (ctx.stories.length === 0 && PERSONAL.test(text)) {
      findings.push({
        kind: 'personal_without_story',
        where,
        detail:
          'makes a first-person statement about family or clients, and the post has no Story Bank entry to back one',
      });
    }
  }
  return findings;
}

/** The audit pass: Claude lists every claim and maps it to a source or story. */
export async function auditClaims(
  deps: Pick<CheckerDeps, 'llm' | 'voice'>,
  draft: Draft,
  ctx: CheckContext
): Promise<Finding[]> {
  const sourceIds = new Set(ctx.sourceItems.map((s) => s.id));
  const storyIds = new Set(ctx.stories.map((s) => s.id));
  const audit = await deps.llm.json({
    label: 'audit',
    system: renderPrompt('audit', {}),
    user: JSON.stringify(
      {
        draft: { copy: draft.copy, slides: draft.slides },
        source_items: ctx.sourceItems.map((s) => ({
          id: s.id,
          url: s.url,
          title: s.title,
          text: s.body_text,
        })),
        stories: ctx.stories.map((s) => ({ id: s.id, body: s.body })),
      },
      null,
      2
    ),
    schema: AuditWire,
    effort: 'high',
  });

  const findings: Finding[] = [];
  for (const claim of audit.claims) {
    // The model's "supported" is necessary, not sufficient: the id has to be real and of the right kind.
    const backed =
      claim.kind === 'personal'
        ? claim.story_id !== null && storyIds.has(claim.story_id)
        : claim.source_item_id !== null && sourceIds.has(claim.source_item_id);
    if (!claim.supported || !backed) {
      const needs = claim.kind === 'personal' ? 'a Story Bank entry' : 'a source page';
      findings.push({
        kind: 'unsourced_claim',
        where: 'draft',
        detail: `${claim.kind} claim with no backing from ${needs}: "${claim.text}"`,
      });
    }
  }
  return findings;
}

/** Check one draft. Any finding fails it. */
export async function check(
  deps: CheckerDeps,
  draft: Draft,
  ctx: CheckContext
): Promise<CheckResult> {
  const findings = scanDraft(deps, draft, ctx);
  findings.push(...(await auditClaims(deps, draft, ctx)));
  return { ok: findings.length === 0, findings };
}

export type CheckedDraft =
  { ok: true; draft: Draft; rewrites: number } | { ok: false; reasons: string[]; rewrites: number };

export const findingLine = (f: Finding) => `${f.where}: ${f.detail}`;

/**
 * Check a draft; on failure send it back to the writer once with the findings
 * and check the rewrite. A second failure is final.
 */
export async function checkWithRewrite(
  deps: CheckerDeps,
  draft: Draft,
  ctx: CheckContext,
  rewrite: (findings: string[]) => Promise<Draft>
): Promise<CheckedDraft> {
  const first = await check(deps, draft, ctx);
  if (first.ok) return { ok: true, draft, rewrites: 0 };
  const second = await rewrite(first.findings.map(findingLine));
  const again = await check(deps, second, ctx);
  if (again.ok) return { ok: true, draft: second, rewrites: 1 };
  return { ok: false, reasons: again.findings.map(findingLine), rewrites: 1 };
}
