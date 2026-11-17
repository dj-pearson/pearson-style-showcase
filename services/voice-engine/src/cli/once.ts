/**
 * Run one track end to end now, from the command line.
 *
 *   npm run once -- --track eatpal --dry-run
 *
 * Without --dry-run the run is real only when VOICE_DRY_RUN=false.
 */
import { ConfigError, loadConfig } from '../config.js';
import { runTrack } from '../pipeline.js';
import { buildRuntime } from '../runtime.js';
import { TRACKS, type TrackKey } from '../types.js';
import { parseArgs } from './args.js';

async function main(): Promise<number> {
  const { flags, values } = parseArgs(process.argv.slice(2));
  const track = values.get('track');
  if (!track || !(TRACKS as readonly string[]).includes(track)) {
    console.error(`usage: npm run once -- --track <${TRACKS.join('|')}> [--dry-run]`);
    return 2;
  }
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      return 1;
    }
    throw err;
  }
  const { deps } = buildRuntime(config);
  try {
    const result = await runTrack(deps, track as TrackKey, {
      dryRun: flags.has('dry-run'),
      force: true,
    });
    if (result.outcome !== 'done') {
      console.log(JSON.stringify(result, null, 2));
      return 1;
    }
    const p = result.post;
    console.log(`post id:  ${p.id}`);
    console.log(`status:   ${p.status}${p.dry_run ? ' (dry run)' : ''}`);
    console.log(`product:  ${p.product}`);
    console.log(`format:   ${p.format ?? '-'}`);
    if (p.skip_reason) console.log(`stopped:  ${p.skip_stage}: ${p.skip_reason}`);
    if (p.copy) console.log(`\ncopy:\n${JSON.stringify(p.copy, null, 2)}`);
    if (p.image_urls.length) console.log(`\nimages:\n${p.image_urls.join('\n')}`);
    if (p.video_url) console.log(`\nvideo:\n${p.video_url}`);
    return p.status === 'skipped' || p.status === 'failed' ? 1 : 0;
  } finally {
    await deps.renderer.close();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
