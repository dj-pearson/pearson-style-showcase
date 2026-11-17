import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.js';

const good = {
  SUPABASE_URL: 'https://api.example.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-value',
  ANTHROPIC_API_KEY: 'anthropic-value',
  VOICE_WEBHOOK_SECRET: 'webhook-secret-value-123',
  VOICE_RUN_SECRET: 'run-secret-value-1234567',
  TZ: 'America/Chicago',
};

describe('loadConfig', () => {
  it('applies the documented defaults', () => {
    const c = loadConfig(good);
    expect(c.model).toBe('claude-opus-5-5');
    expect(c.dryRun).toBe(true);
    expect(c.handle).toBe('@danpearson');
    expect(c.denyTerms).toEqual([]);
    expect(c.functionsUrl).toBe('https://api.example.test/functions/v1');
  });

  it('only leaves dry-run when told to in so many words', () => {
    expect(loadConfig({ ...good, VOICE_DRY_RUN: 'false' }).dryRun).toBe(false);
    expect(loadConfig({ ...good, VOICE_DRY_RUN: 'true' }).dryRun).toBe(true);
    expect(() => loadConfig({ ...good, VOICE_DRY_RUN: 'off' })).toThrow(ConfigError);
  });

  it('splits deny terms on commas', () => {
    expect(loadConfig({ ...good, VOICE_DENY_TERMS: ' Acme Corp, Globex ,' }).denyTerms).toEqual([
      'Acme Corp',
      'Globex',
    ]);
  });

  it('names every missing variable and prints no values', () => {
    const { ANTHROPIC_API_KEY: _a, VOICE_RUN_SECRET: _r, ...rest } = good;
    try {
      loadConfig(rest);
      expect.unreachable('loadConfig should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const e = err as ConfigError;
      expect(e.variables).toEqual(['ANTHROPIC_API_KEY', 'VOICE_RUN_SECRET']);
      expect(e.message).toContain('ANTHROPIC_API_KEY');
      for (const value of Object.values(rest)) expect(e.message).not.toContain(value);
    }
  });

  it('rejects a present but invalid value by name, without echoing it', () => {
    try {
      loadConfig({ ...good, VOICE_WEBHOOK_SECRET: 'short' });
      expect.unreachable('loadConfig should have thrown');
    } catch (err) {
      expect((err as ConfigError).variables).toEqual(['VOICE_WEBHOOK_SECRET']);
      expect((err as Error).message).not.toContain('short');
    }
  });
});
