import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGE_ROOT } from './paths.js';

/**
 * The four hard rules, word for word as Dan agreed to them. The source of
 * truth is docs/voice-engine/DESIGN.md; this copy exists because the Docker
 * image holds only services/voice-engine. design.test.ts fails if the two
 * drift apart.
 */
export const HARD_RULES = `1. **No invented claims.** Any personal fact (about Dan, his kid, a client, a number he achieved) must come from a confirmed Story Bank entry. Any product fact must come from a fetched source item. A draft with an unsourced claim is rewritten once, then the track skips the day.
2. **No engagement farming.** No bait questions, "Agree?", "Thoughts?", "Comment X below", "Follow for more", "Like if", "Let that sink in", "Unpopular opinion:", "Nobody talks about", \u{1F9F5}/\u{1F447}/\u{1F525} bait, thread hooks. Not every post ends in a question; most should end where the point ends.
3. Dan's employer is never named. Clients are anonymous unless the story says otherwise. No prices in posts.
4. Never double-post. A platform that already accepted a post is never sent it again.`;

/** The same section read from DESIGN.md, or null when the repo's docs are not on disk (in the image). */
export function hardRulesFromDesignDoc(): string | null {
  const file = join(PACKAGE_ROOT, '..', '..', 'docs', 'voice-engine', 'DESIGN.md');
  if (!existsSync(file)) return null;
  const doc = readFileSync(file, 'utf8');
  const m = doc.match(/## Hard rules \(anti-goals\)\n\n([\s\S]*?)\n\n## /);
  return m ? m[1]!.trim() : null;
}
