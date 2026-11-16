import * as z from 'zod/v4';

/**
 * Environment validation. Startup fails with the NAMES of the missing or
 * invalid variables. Values are never printed: several of these are secrets.
 */

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === '') return def;
      const s = v.trim().toLowerCase();
      if (['true', '1', 'yes'].includes(s)) return true;
      if (['false', '0', 'no'].includes(s)) return false;
      ctx.addIssue({ code: 'custom', message: 'must be true or false' });
      return z.NEVER;
    });

const required = z.string().trim().min(1);

const EnvSchema = z.object({
  SUPABASE_URL: required.url(),
  SUPABASE_SERVICE_ROLE_KEY: required,
  ANTHROPIC_API_KEY: required,
  VOICE_MODEL: z.string().trim().min(1).default('claude-opus-5-5'),
  VOICE_WEBHOOK_SECRET: required.min(16),
  VOICE_RUN_SECRET: required.min(16),
  // Default true: a service started without this set must not post.
  VOICE_DRY_RUN: bool(true),
  VOICE_HANDLE: z.string().trim().min(1).default('@danpearson'),
  VOICE_DENY_TERMS: z.string().optional(),
  // Self-hosted Supabase serves edge functions from a separate host.
  VOICE_FUNCTIONS_URL: z.string().trim().url().optional(),
  TZ: required,
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
});

export interface Config {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  anthropicApiKey: string;
  model: string;
  webhookSecret: string;
  runSecret: string;
  dryRun: boolean;
  handle: string;
  /** Names that must never appear in a post. Never logged, never stored. */
  denyTerms: string[];
  functionsUrl: string;
  tz: string;
  port: number;
}

export class ConfigError extends Error {
  constructor(public readonly variables: string[]) {
    super(`Invalid or missing environment variables: ${variables.join(', ')}`);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].sort();
    throw new ConfigError(names);
  }
  const e = parsed.data;
  return {
    supabaseUrl: e.SUPABASE_URL.replace(/\/+$/, ''),
    supabaseServiceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY,
    anthropicApiKey: e.ANTHROPIC_API_KEY,
    model: e.VOICE_MODEL,
    webhookSecret: e.VOICE_WEBHOOK_SECRET,
    runSecret: e.VOICE_RUN_SECRET,
    dryRun: e.VOICE_DRY_RUN,
    handle: e.VOICE_HANDLE,
    denyTerms: (e.VOICE_DENY_TERMS ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    functionsUrl: (
      e.VOICE_FUNCTIONS_URL ?? `${e.SUPABASE_URL.replace(/\/+$/, '')}/functions/v1`
    ).replace(/\/+$/, ''),
    tz: e.TZ,
    port: e.PORT,
  };
}
