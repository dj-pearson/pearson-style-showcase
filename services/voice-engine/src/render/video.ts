import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export const HOOK_SECONDS = 3;
export const SLIDE_SECONDS = 2.5;
export const CROSSFADE = 0.4;
export const MIN_TOTAL = 8;
export const MAX_TOTAL = 45;
const FADE_OUT = 1;

/**
 * Seconds each frame is on screen, including the half of each crossfade it
 * shares with its neighbours. Scaled evenly when the natural length falls
 * outside 8 to 45 seconds.
 */
export function slideDurations(count: number): number[] {
  if (count < 2) throw new Error('a video needs at least two frames');
  const base = Array.from({ length: count }, (_, i) => (i === 0 ? HOOK_SECONDS : SLIDE_SECONDS));
  const total = (d: number[]) => d.reduce((a, b) => a + b, 0) - CROSSFADE * (count - 1);
  const t = total(base);
  const target = t < MIN_TOTAL ? MIN_TOTAL : t > MAX_TOTAL ? MAX_TOTAL : t;
  if (target === t) return base;
  const overlap = CROSSFADE * (count - 1);
  const k = (target + overlap) / (t + overlap);
  return base.map((d) => d * k);
}

export function videoLength(durations: number[]): number {
  return durations.reduce((a, b) => a + b, 0) - CROSSFADE * (durations.length - 1);
}

export interface VideoInput {
  /** 1080x1920 PNG frames in order. */
  frames: Buffer[];
  /** MP3 bytes, or null for a silent track. */
  music: Buffer | null;
}

/** Build an H.264/AAC 1080x1920 30fps MP4 from the frames. */
export async function buildVideo(input: VideoInput): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'voice-video-'));
  try {
    const durations = slideDurations(input.frames.length);
    const length = videoLength(durations);
    const args: string[] = ['-y', '-hide_banner', '-loglevel', 'error'];
    for (let i = 0; i < input.frames.length; i++) {
      const f = join(dir, `f${i}.png`);
      await writeFile(f, input.frames[i]!);
      args.push('-loop', '1', '-framerate', '30', '-t', durations[i]!.toFixed(3), '-i', f);
    }
    const audioIndex = input.frames.length;
    if (input.music) {
      const m = join(dir, 'music.mp3');
      await writeFile(m, input.music);
      args.push('-stream_loop', '-1', '-i', m);
    } else {
      args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
    }

    const filters: string[] = [];
    for (let i = 0; i < input.frames.length; i++)
      filters.push(`[${i}:v]fps=30,format=yuv420p,setsar=1[s${i}]`);
    let prev = 's0';
    let elapsed = durations[0]!;
    for (let i = 1; i < input.frames.length; i++) {
      const offset = elapsed - CROSSFADE * i;
      const out = i === input.frames.length - 1 ? 'vout' : `x${i}`;
      filters.push(
        `[${prev}][s${i}]xfade=transition=fade:duration=${CROSSFADE}:offset=${offset.toFixed(3)}[${out}]`
      );
      prev = out;
      elapsed += durations[i]!;
    }
    const fadeStart = Math.max(0, length - FADE_OUT).toFixed(3);
    filters.push(
      input.music
        ? `[${audioIndex}:a]atrim=0:${length.toFixed(3)},loudnorm=I=-18:TP=-2:LRA=11,afade=t=out:st=${fadeStart}:d=${FADE_OUT},aresample=44100[aout]`
        : `[${audioIndex}:a]atrim=0:${length.toFixed(3)}[aout]`
    );

    const out = join(dir, 'video.mp4');
    args.push(
      '-filter_complex',
      filters.join(';'),
      '-map',
      '[vout]',
      '-map',
      '[aout]',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-r',
      '30',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-ar',
      '44100',
      '-t',
      length.toFixed(3),
      '-movflags',
      '+faststart',
      out
    );
    await run('ffmpeg', args, { maxBuffer: 16 * 1024 * 1024 });
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export interface Probe {
  width: number;
  height: number;
  duration: number;
  videoCodec: string;
  audioCodec: string | null;
  fps: number;
}

export async function probe(file: string): Promise<Probe> {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-show_streams',
    '-show_format',
    '-of',
    'json',
    file,
  ]);
  const j = JSON.parse(stdout) as {
    streams: {
      codec_type: string;
      codec_name: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
    }[];
    format: { duration: string };
  };
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  if (!v) throw new Error('no video stream');
  const [num, den] = (v.r_frame_rate ?? '0/1').split('/').map(Number);
  return {
    width: v.width ?? 0,
    height: v.height ?? 0,
    duration: Number(j.format.duration),
    videoCodec: v.codec_name,
    audioCodec: a?.codec_name ?? null,
    fps: den ? num! / den : 0,
  };
}
