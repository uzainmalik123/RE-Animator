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

/** The compiler's only view of an LLM (D-32). Anthropic or Bedrock (F19), fakes in tests. */
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

export function createLlmClient(opts: { provider: LlmProvider; awsRegion?: string | undefined }): LlmClient {
  return opts.provider === 'bedrock' ? createBedrockClient(opts.awsRegion ? { awsRegion: opts.awsRegion } : {}) : createAnthropicClient();
}

/** Why a cache-only compile (the F21 sandbox, D-49) couldn't plan a pair. */
export const CACHE_ONLY_MESSAGE = 'not in the plan cache (cache-only run)';

/** Never calls a provider: a cache miss becomes an `uncompilable` pair, and no API key is needed (F21, D-49). */
export function cacheOnlyLlm(): LlmClient {
  return { complete: () => Promise.reject(new Error(CACHE_ONLY_MESSAGE)) };
}
