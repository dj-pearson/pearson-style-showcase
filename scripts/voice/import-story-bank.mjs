#!/usr/bin/env node
/**
 * One-time import of confirmed Story Bank notes from the Hermes vault into
 * voice_stories (VOICE-005).
 *
 *   node scripts/voice/import-story-bank.mjs <folder> \
 *     --confirmed-key <frontmatter key> --confirmed-value <value> \
 *     [--tracks-key <key>] [--products-key <key>] [--apply]
 *
 * Without --apply it prints what it would insert and writes nothing.
 * With --apply it needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from
 * Infisical: `infisical run -- node scripts/voice/import-story-bank.mjs ...`).
 *
 * The frontmatter key names are flags on purpose, with no defaults. The PRD
 * says to take them from the hub code in the Server repo that reads the
 * Story Bank, and not to guess them. Read that code, then pass them here.
 *
 * Re-running never duplicates: each note's vault-relative path is stored as
 * source_ref and notes already imported are skipped.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const TRACKS = ['gradethread', 'eatpal', 'platform'];
const PRODUCTS = ['gradethread', 'eatpal', 'brikly', 'printyx', 'agentbio'];

export function parseNote(text) {
  const m = text.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text.trim() };
  const data = parseYaml(m[1]) ?? {};
  return { data: typeof data === 'object' ? data : {}, body: m[2].trim() };
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) yield full;
  }
}

const asList = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);

/**
 * Plan the import: which notes become stories, which are skipped and why.
 * `existingRefs` is the set of source_ref values already in voice_stories.
 */
export async function planImport(folder, opts, existingRefs = new Set()) {
  const plan = { insert: [], unconfirmed: 0, alreadyImported: 0, empty: 0 };
  for await (const file of walk(folder)) {
    const ref = relative(folder, file).split(sep).join('/');
    const { data, body } = parseNote(await readFile(file, 'utf8'));
    if (String(data[opts.confirmedKey] ?? '').trim().toLowerCase() !== String(opts.confirmedValue).trim().toLowerCase()) {
      plan.unconfirmed += 1;
      continue;
    }
    if (existingRefs.has(ref)) {
      plan.alreadyImported += 1;
      continue;
    }
    if (!body) {
      plan.empty += 1;
      continue;
    }
    plan.insert.push({
      body,
      tracks: opts.tracksKey ? asList(data[opts.tracksKey]).filter((t) => TRACKS.includes(t)) : [],
      products: opts.productsKey ? asList(data[opts.productsKey]).filter((p) => PRODUCTS.includes(p)) : [],
      confirmed: true,
      source: 'vault-import',
      source_ref: ref,
    });
  }
  plan.insert.sort((a, b) => a.source_ref.localeCompare(b.source_ref));
  return plan;
}

function parseArgs(argv) {
  const out = { folder: null, apply: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a.startsWith('--')) out[a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
    else out.folder = a;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.folder || !args.confirmedKey || args.confirmedValue === undefined) {
    console.error('usage: import-story-bank.mjs <folder> --confirmed-key <key> --confirmed-value <value> [--tracks-key <key>] [--products-key <key>] [--apply]');
    process.exit(2);
  }
  let db = null;
  let existing = new Set();
  if (args.apply) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error('--apply needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
      process.exit(1);
    }
    const { createClient } = await import('@supabase/supabase-js');
    db = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await db.from('voice_stories').select('source_ref').not('source_ref', 'is', null);
    if (error) throw new Error(`read voice_stories: ${error.message}`);
    existing = new Set(data.map((r) => r.source_ref));
  }
  const plan = await planImport(args.folder, args, existing);
  for (const s of plan.insert) console.log(`${args.apply ? 'insert' : 'would insert'}  ${s.source_ref}  [${s.tracks.join(',')}] ${s.body.slice(0, 80).replace(/\s+/g, ' ')}`);
  if (args.apply && plan.insert.length) {
    const { error } = await db.from('voice_stories').insert(plan.insert);
    if (error) throw new Error(`insert: ${error.message}`);
  }
  console.log(`\n${plan.insert.length} to insert, ${plan.alreadyImported} already imported, ${plan.unconfirmed} not confirmed (skipped), ${plan.empty} empty${args.apply ? '' : '. Dry run: pass --apply to write.'}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
