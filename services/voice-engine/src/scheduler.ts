import cron from 'node-cron';
import { localParts, timeToMinutes } from './clock.js';
import { recordMissed, runTrack, type PipelineDeps } from './pipeline.js';
import type { Track, TrackKey } from './types.js';

/** A track whose time passed more than this long ago is recorded as missed, not posted late. */
export const MISSED_WINDOW_MIN = 180;

export type Decision = {
  track: Track;
  runDate: string;
  action: 'run' | 'miss' | 'wait' | 'done' | 'off';
};

/**
 * What each track should do right now. `hasPost` says whether a real post
 * row already exists for that track and local day.
 */
export async function decide(
  tracks: Track[],
  now: Date,
  hasPost: (track: TrackKey, runDate: string) => Promise<boolean>
): Promise<Decision[]> {
  const out: Decision[] = [];
  for (const track of tracks) {
    const { date, minutes } = localParts(now, track.timezone);
    if (!track.enabled) {
      out.push({ track, runDate: date, action: 'off' });
      continue;
    }
    const due = timeToMinutes(track.post_time);
    if (minutes < due) out.push({ track, runDate: date, action: 'wait' });
    else if (await hasPost(track.key, date)) out.push({ track, runDate: date, action: 'done' });
    else
      out.push({
        track,
        runDate: date,
        action: minutes - due > MISSED_WINDOW_MIN ? 'miss' : 'run',
      });
  }
  return out;
}

export class Scheduler {
  private readonly running = new Set<TrackKey>();
  private task: ReturnType<typeof cron.schedule> | null = null;

  constructor(private readonly deps: PipelineDeps) {}

  /** Tick every 5 minutes, and once now. */
  start(): void {
    this.task = cron.schedule('*/5 * * * *', () => void this.tick());
    void this.tick();
  }

  stop(): void {
    void this.task?.stop();
    this.task = null;
  }

  isRunning(track: TrackKey): boolean {
    return this.running.has(track);
  }

  /** Run a track in the background unless it is already running in this process. */
  launch(track: TrackKey, opts: { dryRun?: boolean; force?: boolean } = {}): boolean {
    if (this.running.has(track)) return false;
    this.running.add(track);
    runTrack(this.deps, track, opts)
      .catch((err: unknown) =>
        (this.deps.log ?? console.error)(
          `[voice] ${track} run crashed: ${err instanceof Error ? err.message : String(err)}`
        )
      )
      .finally(() => this.running.delete(track));
    return true;
  }

  async tick(): Promise<Decision[]> {
    const now = (this.deps.now ?? (() => new Date()))();
    try {
      const tracks = await this.deps.store.getTracks();
      // A dry-run service makes one dry post per track per day, so "already
      // done today" has to look at posts in the mode the service runs in.
      const dry = this.deps.dryRun;
      const decisions = await decide(
        tracks,
        now,
        async (t, d) => (await this.deps.store.findPost(t, d, dry)) !== null
      );
      for (const d of decisions) {
        if (d.action === 'run') this.launch(d.track.key);
        // A missed day is only worth an email when the engine is live.
        if (d.action === 'miss' && !dry && !this.running.has(d.track.key))
          await recordMissed(this.deps, d.track, d.runDate);
      }
      return decisions;
    } catch (err) {
      (this.deps.log ?? console.error)(
        `[voice] scheduler tick failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return [];
    }
  }
}
