import type { Config } from './config.js';
import { AnthropicLlm } from './llm.js';
import { SupabaseMedia } from './media.js';
import { ConsoleNotifier, EdgeNotifier } from './notify.js';
import type { PipelineDeps } from './pipeline.js';
import { SlideRenderer } from './render/slides.js';
import { Scheduler } from './scheduler.js';
import { SupabaseStore } from './store.js';
import { loadVoice } from './voice.js';

/** Wire the real dependencies from validated config. */
export function buildRuntime(config: Config): { deps: PipelineDeps; scheduler: Scheduler } {
  const store = SupabaseStore.connect(config.supabaseUrl, config.supabaseServiceRoleKey);
  const deps: PipelineDeps = {
    store,
    llm: new AnthropicLlm(config.anthropicApiKey, config.model),
    voice: loadVoice(),
    media: new SupabaseMedia(store.client),
    renderer: new SlideRenderer(),
    // Dry runs never email, so a dry-run service logs to the console instead.
    notifier: config.dryRun
      ? new ConsoleNotifier()
      : new EdgeNotifier(config.functionsUrl, config.supabaseServiceRoleKey),
    webhookSecret: config.webhookSecret,
    handle: config.handle,
    denyTerms: config.denyTerms,
    dryRun: config.dryRun,
  };
  return { deps, scheduler: new Scheduler(deps) };
}
