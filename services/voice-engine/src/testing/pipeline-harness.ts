import type { Notifier, SkipNotice } from '../notify.js';
import { FakeLlm } from '../llm.js';
import { LocalMedia } from '../media.js';
import type { PipelineDeps } from '../pipeline.js';
import type { SlideRenderer } from '../render/slides.js';
import { loadVoice } from '../voice.js';
import { MemoryStore } from './memory-store.js';

/** A renderer that returns blank PNG-shaped buffers without starting Chromium. */
export class StubRenderer {
  calls = 0;
  async render(slides: unknown[]): Promise<Buffer[]> {
    this.calls += 1;
    return slides.map(() => Buffer.from('png'));
  }
  async open() {}
  async close() {}
}

export class RecordingNotifier implements Notifier {
  readonly notices: SkipNotice[] = [];
  async skipped(n: SkipNotice) {
    this.notices.push(n);
  }
}

export function harness(now: Date, over: Partial<PipelineDeps> = {}) {
  const store = new MemoryStore();
  store.now = () => now;
  const llm = new FakeLlm();
  const notifier = new RecordingNotifier();
  const media = new LocalMedia('/nonexistent-never-written');
  const written: string[] = [];
  media.upload = async (path: string) => {
    written.push(path);
    return `https://cdn.test/${path}`;
  };
  const deps: PipelineDeps = {
    store,
    llm,
    voice: loadVoice(),
    media,
    renderer: new StubRenderer() as unknown as SlideRenderer,
    notifier,
    webhookSecret: 'test-webhook-secret-value',
    handle: '@danpearson',
    denyTerms: [],
    dryRun: false,
    now: () => now,
    // Sites are unreachable in tests; refreshSources records a failure and the pipeline carries on.
    fetcher: async () => {
      throw new Error('offline');
    },
    sleep: async () => {},
    log: () => {},
    render: async (_d, post) => ({
      imageUrls: post.slides.map((_, i) => `https://cdn.test/posts/${post.id}/slide-${i + 1}.png`),
      videoUrl:
        post.format === 'single_image' ? null : `https://cdn.test/posts/${post.id}/video.mp4`,
    }),
    ...over,
  };
  return { store, llm, notifier, written, deps };
}
