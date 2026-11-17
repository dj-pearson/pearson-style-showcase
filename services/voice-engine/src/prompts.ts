import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROMPTS_DIR } from './paths.js';

const cache = new Map<string, string>();

/**
 * Load src/prompts/<name>.md and fill its {{placeholders}}. Every placeholder
 * in the file must be supplied and every supplied value must be used, so a
 * prompt and its caller cannot drift apart silently.
 */
export function renderPrompt(name: string, vars: Record<string, string>): string {
  let template = cache.get(name);
  if (template === undefined) {
    template = readFileSync(join(PROMPTS_DIR, `${name}.md`), 'utf8');
    cache.set(name, template);
  }
  const used = new Set<string>();
  const out = template.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => {
    if (!(key in vars)) throw new Error(`prompt "${name}": no value for {{${key}}}`);
    used.add(key);
    return vars[key]!;
  });
  const unused = Object.keys(vars).filter((k) => !used.has(k));
  if (unused.length) throw new Error(`prompt "${name}": unused values ${unused.join(', ')}`);
  return out.replace(/\n{3,}/g, '\n\n').trim();
}
