import Anthropic from '@anthropic-ai/sdk';
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { PersonaId } from '../personas/registry.js';
import type { LlmProvider } from '../config/schema.js';
import { LlmOutputSchema } from './dsl.js';
import { CompilerError } from './errors.js';

/** `raw` is the provider's own assistant content, replayed unchanged so a retry stays append-only. */
export type LlmTurn = { role: 'user'; text: string } | { role: 'assistant'; raw: unknown };

export type LlmRequest = {
  model: string;
  system: string;
  turns: LlmTurn[];
  /** For fakes and logs only; never sent to the provider. */
  meta: { criterion: string; persona: PersonaId; attempt: 1 | 2 };
  /** Cancels the request (Ctrl-C). */
  signal?: AbortSignal;
};

export type LlmResponse =
  | { kind: 'output'; text: string; stopReason: string | null; raw: unknown }
  | { kind: 'refusal'; detail: string };

/** The compiler's only view of an LLM (D-32). Anthropic, Bedrock (F19) or OpenAI-compatible (D-50), fakes in tests. */
export interface LlmClient {
  complete(req: LlmRequest): Promise<LlmResponse>;
}

const DEFAULT_MAX_TOKENS = 16000;

type Messages = Pick<Anthropic, 'messages'>;

const setupError = (err: unknown) =>
  new CompilerError(`The LLM client could not be set up: ${err instanceof Error ? err.message : String(err)}`, { cause: err });

/**
 * Structured output via `messages.create` (not `parse`, which throws on a schema mismatch and
 * would lose the text the retry replays). Our own validation always re-runs on the text.
 * `make` runs on the first call, so a constructor that finds no credentials or region fails as a setup error.
 */
function messagesClient(make: () => Messages, opts: { maxTokens?: number; mapModel?: (model: string) => string }): LlmClient {
  let client: Messages | undefined;
  const { type, schema } = zodOutputFormat(LlmOutputSchema);
  return {
    async complete(req) {
      try {
        client ??= make();
      } catch (err) {
        throw setupError(err);
      }
      let message: Anthropic.Message;
      try {
        const body: Anthropic.MessageCreateParamsNonStreaming = {
          model: opts.mapModel ? opts.mapModel(req.model) : req.model,
          max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
          system: req.system,
          messages: req.turns.map(
            (t): Anthropic.MessageParam =>
              t.role === 'user' ? { role: 'user', content: t.text } : { role: 'assistant', content: t.raw as Anthropic.ContentBlockParam[] },
          ),
          output_config: { format: { type, schema } },
        };
        message = await (req.signal ? client.messages.create(body, { signal: req.signal }) : client.messages.create(body));
      } catch (err) {
        if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
          throw new CompilerError(`The LLM provider rejected the credentials (HTTP ${err.status}).`, { cause: err });
        }
        // Anything that isn't an SDK error was raised while setting up the request, e.g. no credentials.
        if (!(err instanceof Anthropic.AnthropicError)) throw setupError(err);
        throw err;
      }
      if (message.stop_reason === 'refusal') {
        return { kind: 'refusal', detail: message.stop_details?.category ?? 'refused' };
      }
      const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
      return { kind: 'output', text, stopReason: message.stop_reason, raw: message.content };
    },
  };
}

export function createAnthropicClient(opts: { anthropic?: Messages; maxTokens?: number } = {}): LlmClient {
  const { anthropic } = opts;
  return messagesClient(() => anthropic ?? new Anthropic(), opts);
}

/** Bedrock wants `anthropic.`-prefixed ids; profiles (`us.anthropic.…`), ARNs and prefixed ids pass through. */
export function bedrockModelId(model: string): string {
  return model.startsWith('claude-') ? `anthropic.${model}` : model;
}

/**
 * Claude in Amazon Bedrock through the Messages-API (Mantle) endpoint (F19, D-47). Credentials come from the
 * SDK's chain: `AWS_BEARER_TOKEN_BEDROCK`, the AWS key variables, `AWS_PROFILE`, then the default chain.
 * The region is `awsRegion`, else `AWS_REGION` / `AWS_DEFAULT_REGION`.
 */
export function createBedrockClient(opts: { awsRegion?: string; mantle?: Messages; maxTokens?: number } = {}): LlmClient {
  const { mantle, awsRegion } = opts;
  const make = () => {
    if (mantle) return mantle;
    const env = process.env;
    if (!awsRegion && !env.AWS_REGION && !env.AWS_DEFAULT_REGION && !env.ANTHROPIC_BEDROCK_MANTLE_BASE_URL) {
      // The SDK's own message points at its constructor, which a Poltergeist user never sees.
      throw new Error('Bedrock needs an AWS region: set "awsRegion" in poltergeist.config.json, or AWS_REGION.');
    }
    return new AnthropicBedrockMantle(awsRegion ? { awsRegion } : {});
  };
  return messagesClient(make, { ...opts, mapModel: bedrockModelId });
}

/** The OpenAI-compatible providers (D-50; Gemini removed by D-51): free tiers for testing, Claude for the real run. */
export const OPENAI_COMPATIBLE = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', keyVar: 'GROQ_API_KEY' },
  ollama: { baseUrl: 'http://127.0.0.1:11434/v1', keyVar: undefined },
} as const;
export type OpenAiCompatibleProvider = keyof typeof OPENAI_COMPATIBLE;

const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 5;

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type ChatResponse = { choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string | null }[] };

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

/** `Retry-After` in seconds when the provider sends one, else exponential backoff from 2 s, capped at 60 s. */
function backoffMs(res: Response, attempt: number): number {
  const after = Number(res.headers.get('retry-after'));
  return Math.min(60_000, Number.isFinite(after) && after > 0 ? after * 1000 : 2000 * 2 ** (attempt - 1));
}

/**
 * Chat Completions over plain `fetch` (D-50). Free tiers rate-limit hard, so a 429 or 5xx is retried here
 * (the Anthropic SDK does its own). The plan format reaches the model twice, as `response_format` and in the
 * system message, because some models ignore `response_format`; our own validation re-runs on the text either way.
 */
export function createOpenAiCompatibleClient(opts: {
  provider: OpenAiCompatibleProvider;
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
  maxTokens?: number;
  /** Tests only: the delay between retries. */
  backoff?: (res: Response, attempt: number) => number;
}): LlmClient {
  const { baseUrl, keyVar } = OPENAI_COMPATIBLE[opts.provider];
  const doFetch = opts.fetch ?? fetch;
  const backoff = opts.backoff ?? backoffMs;
  const { schema } = zodOutputFormat(LlmOutputSchema);
  const format = `Answer with one JSON object only, no prose and no code fence, matching this JSON Schema:\n${JSON.stringify(schema)}`;
  return {
    async complete(req) {
      const key = keyVar ? (opts.env ?? process.env)[keyVar] : undefined;
      if (keyVar && !key) throw setupError(new Error(`${keyVar} is not set (provider "${opts.provider}")`));
      const messages: ChatMessage[] = [
        { role: 'system', content: `${req.system}\n\n${format}` },
        ...req.turns.map((t): ChatMessage => (t.role === 'user' ? { role: 'user', content: t.text } : { role: 'assistant', content: String(t.raw) })),
      ];
      const body = JSON.stringify({
        model: req.model,
        max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
        messages,
        response_format: { type: 'json_schema', json_schema: { name: 'test_plan', schema } },
      });
      const headers: Record<string, string> = { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) };
      for (let attempt = 1; ; attempt++) {
        const res = await doFetch(`${baseUrl}/chat/completions`, { method: 'POST', headers, body, ...(req.signal ? { signal: req.signal } : {}) });
        if (res.status === 401 || res.status === 403) {
          throw new CompilerError(`The LLM provider rejected the credentials (HTTP ${res.status}).`);
        }
        if (RETRY_STATUSES.has(res.status) && attempt < MAX_ATTEMPTS) {
          await res.body?.cancel();
          await sleep(backoff(res, attempt), req.signal);
          continue;
        }
        if (!res.ok) throw new Error(`${opts.provider} returned HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const choice = ((await res.json()) as ChatResponse).choices?.[0];
        const refusal = choice?.message?.refusal;
        if (refusal || choice?.finish_reason === 'content_filter') return { kind: 'refusal', detail: refusal || 'content_filter' };
        const text = choice?.message?.content ?? '';
        // The compiler treats `max_tokens` as a truncated answer (Anthropic's name for it).
        const stopReason = choice?.finish_reason === 'length' ? 'max_tokens' : (choice?.finish_reason ?? null);
        return { kind: 'output', text, stopReason, raw: text };
      }
    },
  };
}

export function createLlmClient(opts: { provider: LlmProvider; awsRegion?: string | undefined }): LlmClient {
  if (opts.provider === 'bedrock') return createBedrockClient(opts.awsRegion ? { awsRegion: opts.awsRegion } : {});
  if (opts.provider === 'anthropic') return createAnthropicClient();
  return createOpenAiCompatibleClient({ provider: opts.provider });
}

/** Why a cache-only compile (the F21 sandbox, D-49) couldn't plan a pair. */
export const CACHE_ONLY_MESSAGE = 'not in the plan cache (cache-only run)';

/** Never calls a provider: a cache miss becomes an `uncompilable` pair, and no API key is needed (F21, D-49). */
export function cacheOnlyLlm(): LlmClient {
  return { complete: () => Promise.reject(new Error(CACHE_ONLY_MESSAGE)) };
}
