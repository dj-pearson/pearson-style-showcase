import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type * as z from 'zod/v4';

/**
 * The one thing the engine asks of Claude: answer in JSON that matches a
 * schema. Topic picker, writer and auditor all go through this, so the tests
 * can stand in a fake without touching the SDK.
 */
export interface Llm {
  json<S extends z.ZodType>(req: LlmRequest<S>): Promise<z.infer<S>>;
}

export interface LlmRequest<S extends z.ZodType> {
  /** Short label for logs and errors: 'topic', 'write', 'audit'. */
  label: string;
  system: string;
  user: string;
  /**
   * The shape sent to the API as the output format. Keep it to plain types:
   * length and count limits are checked by the caller afterwards, because the
   * API's structured-output schema does not enforce them.
   */
  schema: S;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  maxTokens?: number;
}

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export class AnthropicLlm implements Llm {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async json<S extends z.ZodType>(req: LlmRequest<S>): Promise<z.infer<S>> {
    let response;
    try {
      response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: req.maxTokens ?? 16000,
        // Thinking is always on for the default model; effort is the only depth control.
        output_config: { effort: req.effort ?? 'medium', format: betaZodOutputFormat(req.schema) },
        // If the model declines on policy grounds, the API retries on its
        // default fallback model inside the same call instead of failing the day.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
      });
    } catch (err) {
      if (
        err instanceof Anthropic.BadRequestError ||
        err instanceof Anthropic.AuthenticationError
      ) {
        throw new LlmError(`${req.label}: Claude rejected the request (${err.status})`, false);
      }
      if (
        err instanceof Anthropic.PermissionDeniedError ||
        err instanceof Anthropic.NotFoundError
      ) {
        throw new LlmError(`${req.label}: model or key not usable (${err.status})`, false);
      }
      if (err instanceof Anthropic.APIError) {
        throw new LlmError(`${req.label}: Claude API error (${err.status ?? 'network'})`, true);
      }
      throw err;
    }

    if (response.stop_reason === 'refusal') {
      throw new LlmError(`${req.label}: Claude declined the request`, false);
    }
    if (response.stop_reason === 'max_tokens') {
      throw new LlmError(
        `${req.label}: response hit max_tokens before the JSON was complete`,
        true
      );
    }
    if (response.parsed_output == null) {
      throw new LlmError(`${req.label}: response did not parse against the schema`, true);
    }
    return response.parsed_output as z.infer<S>;
  }
}

/** Test double: answers from a queue, in order, and records what it was asked. */
export class FakeLlm implements Llm {
  readonly calls: { label: string; system: string; user: string }[] = [];
  private readonly queue: unknown[] = [];

  enqueue(...answers: unknown[]): this {
    this.queue.push(...answers);
    return this;
  }

  async json<S extends z.ZodType>(req: LlmRequest<S>): Promise<z.infer<S>> {
    this.calls.push({ label: req.label, system: req.system, user: req.user });
    if (this.queue.length === 0) throw new Error(`FakeLlm: no answer queued for "${req.label}"`);
    const next = this.queue.shift();
    if (next instanceof Error) throw next;
    // Mirror the real client: an answer that does not fit the wire schema fails.
    const parsed = req.schema.safeParse(next);
    if (!parsed.success)
      throw new LlmError(`${req.label}: response did not parse against the schema`, true);
    return parsed.data;
  }
}
