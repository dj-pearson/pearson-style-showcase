import { assert, assertEquals } from '../test-asserts.ts';
import {
  AIProviderError,
  callAIWithConfig,
  callProvider,
  callSingleConfig,
  DEFAULT_CLAUDE_MODEL_FALLBACK,
  getDefaultClaudeModel,
  type AIConfig,
} from '../ai-helper.ts';

interface Captured {
  url: string;
  headers: Headers;
  body: Record<string, any>;
}

/** Replace global fetch for one test; `reply` builds each response. */
async function withFetch(
  reply: (call: Captured, n: number) => Response,
  run: (calls: Captured[]) => Promise<void>
): Promise<void> {
  const original = globalThis.fetch;
  const calls: Captured[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const call = {
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body ?? '{}')),
    };
    calls.push(call);
    return reply(call, calls.length);
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

function config(overrides: Partial<AIConfig>): AIConfig {
  return {
    id: 'cfg',
    provider: 'claude',
    model_name: 'claude-test',
    api_key_secret_name: 'TEST_AI_KEY',
    priority: 1,
    is_default: false,
    is_active: true,
    configuration: {},
    use_case: 'all',
    model_tier: 'normal',
    ...overrides,
  };
}

Deno.test('getDefaultClaudeModel reads AI_DEFAULT_CLAUDE_MODEL with a fallback', () => {
  Deno.env.delete('AI_DEFAULT_CLAUDE_MODEL');
  assertEquals(getDefaultClaudeModel(), DEFAULT_CLAUDE_MODEL_FALLBACK);
  Deno.env.set('AI_DEFAULT_CLAUDE_MODEL', 'claude-other');
  assertEquals(getDefaultClaudeModel(), 'claude-other');
  Deno.env.delete('AI_DEFAULT_CLAUDE_MODEL');
});

Deno.test('Gemini key goes in the x-goog-api-key header, not the URL', async () => {
  await withFetch(
    () => Response.json({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] }),
    async (calls) => {
      const text = await callProvider('gemini-free', 'gemini-x', 'SECRET', {
        prompt: 'p',
        maxTokens: 10,
      });
      assertEquals(text, 'hi');
      assert(!calls[0].url.includes('SECRET'), 'key leaked into URL');
      assertEquals(calls[0].headers.get('x-goog-api-key'), 'SECRET');
    }
  );
});

Deno.test('a 500 from a provider is not retried and carries the status', async () => {
  await withFetch(
    () => new Response('overloaded', { status: 500 }),
    async (calls) => {
      let caught: unknown;
      try {
        await callProvider('claude', 'm', 'k', { prompt: 'p', maxTokens: 10 });
      } catch (err) {
        caught = err;
      }
      assert(caught instanceof AIProviderError);
      assertEquals((caught as AIProviderError).status, 500);
      assertEquals((caught as AIProviderError).body, 'overloaded');
      assertEquals(calls.length, 1);
    }
  );
});

Deno.test('a 429 from a provider is retried once', async () => {
  await withFetch(
    (_call, n) =>
      n === 1
        ? new Response('slow down', { status: 429, headers: { 'retry-after': '0' } })
        : Response.json({ content: [{ type: 'text', text: 'ok' }] }),
    async (calls) => {
      const text = await callProvider('claude', 'm', 'k', { prompt: 'p', maxTokens: 10 });
      assertEquals(text, 'ok');
      assertEquals(calls.length, 2);
    }
  );
});

Deno.test('deprecated providers run on Claude and report what ran', async () => {
  Deno.env.set('CLAUDE_API_KEY', 'claude-key');
  try {
    await withFetch(
      () => Response.json({ content: [{ type: 'text', text: 'done' }] }),
      async (calls) => {
        const { response, usedConfig } = await callSingleConfig(
          config({ provider: 'openai', model_name: 'gpt-x', api_key_secret_name: 'OPENAI' }),
          { system: 's', prompt: 'p', maxTokens: 10 },
          { redirectDeprecatedToClaude: true }
        );
        assertEquals(response, 'done');
        assertEquals(usedConfig.provider, 'claude');
        assertEquals(usedConfig.model_name, getDefaultClaudeModel());
        assert(calls[0].url.startsWith('https://api.anthropic.com/'));
        assertEquals(calls[0].headers.get('x-api-key'), 'claude-key');
        assertEquals(calls[0].body.system, 's');
      }
    );
  } finally {
    Deno.env.delete('CLAUDE_API_KEY');
  }
});

Deno.test('callAIWithConfig falls through to the next config', async () => {
  Deno.env.set('TEST_AI_KEY', 'k');
  try {
    await withFetch(
      (call) =>
        call.url.includes('anthropic')
          ? new Response('bad', { status: 400 })
          : Response.json({ choices: [{ message: { content: 'from openai' } }] }),
      async () => {
        const { response, usedConfig } = await callAIWithConfig(
          [config({ provider: 'claude' }), config({ provider: 'openai', model_name: 'gpt' })],
          's',
          'u'
        );
        assertEquals(response, 'from openai');
        assertEquals(usedConfig.provider, 'openai');
      }
    );
  } finally {
    Deno.env.delete('TEST_AI_KEY');
  }
});
