import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { CompilerError } from '../../src/compiler/errors.js';
import { bedrockModelId, createAnthropicClient, createBedrockClient, createLlmClient, createOpenAiCompatibleClient, type LlmRequest } from '../../src/compiler/llm.js';

const req: LlmRequest = {
  model: 'claude-sonnet-5-5',
  system: 'SYS',
  turns: [
    { role: 'user', text: 'first' },
    { role: 'assistant', raw: [{ type: 'text', text: '{"bad":1}' }] },
    { role: 'user', text: 'fix it' },
  ],
  meta: { criterion: '3.2', persona: 'wraith', attempt: 2 },
};

const stub = (impl: (...args: unknown[]) => unknown) => {
  const create = vi.fn(impl);
  return { create, client: createAnthropicClient({ anthropic: { messages: { create } } as unknown as Pick<Anthropic, 'messages'> }) };
};

const message = (over: Record<string, unknown>) => ({
  content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: '{"result":' }, { type: 'text', text: '1}' }],
  stop_reason: 'end_turn',
  stop_details: null,
  ...over,
});

describe('createAnthropicClient', () => {
  it('passes the abort signal to the SDK request (F09 review)', async () => {
    const { create, client } = stub(async () => message({}));
    const ac = new AbortController();
    await client.complete({ ...req, signal: ac.signal });
    expect(create.mock.calls[0]![1]).toEqual({ signal: ac.signal });
  });

  it('sends system, mapped turns, model and json output format', async () => {
    const { create, client } = stub(async () => message({}));
    await client.complete(req);
    const body = create.mock.calls[0]![0] as Record<string, unknown> & { output_config: { format: Record<string, unknown> } };
    expect(body.model).toBe('claude-sonnet-5-5');
    expect(body.system).toBe('SYS');
    expect(body.max_tokens).toBe(16000);
    expect(body.messages).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: [{ type: 'text', text: '{"bad":1}' }] },
      { role: 'user', content: 'fix it' },
    ]);
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.output_config.format.schema).toBeTypeOf('object');
    expect(body.output_config.format).not.toHaveProperty('parse');
    expect(body).not.toHaveProperty('meta');
  });

  it('returns text, stop reason and raw content', async () => {
    const m = message({ stop_reason: 'max_tokens' });
    const { client } = stub(async () => m);
    expect(await client.complete(req)).toEqual({ kind: 'output', text: '{"result":1}', stopReason: 'max_tokens', raw: m.content });
  });

  it('maps refusal', async () => {
    const { client } = stub(async () => message({ stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber', explanation: 'x' } }));
    expect(await client.complete(req)).toEqual({ kind: 'refusal', detail: 'cyber' });
  });

  it('maps refusal without details', async () => {
    const { client } = stub(async () => message({ stop_reason: 'refusal', stop_details: null }));
    expect(await client.complete(req)).toEqual({ kind: 'refusal', detail: 'refused' });
  });

  it('auth error → CompilerError', async () => {
    const { client } = stub(async () => {
      throw new Anthropic.AuthenticationError(401, { type: 'authentication_error' }, 'invalid x-api-key', new Headers());
    });
    await expect(client.complete(req)).rejects.toBeInstanceOf(CompilerError);
  });

  it('permission error → CompilerError', async () => {
    const { client } = stub(async () => {
      throw new Anthropic.PermissionDeniedError(403, {}, 'denied', new Headers());
    });
    await expect(client.complete(req)).rejects.toMatchObject({ name: 'CompilerError', kind: 'auth', exitCode: 2 });
  });

  it('other errors pass through', async () => {
    const boom = new Anthropic.RateLimitError(429, {}, 'slow down', new Headers());
    const { client } = stub(async () => {
      throw boom;
    });
    await expect(client.complete(req)).rejects.toBe(boom);
  });

  it('errors raised before any request (no credentials) → CompilerError', async () => {
    const { client } = stub(async () => {
      throw new Error('Could not resolve authentication method.');
    });
    await expect(client.complete(req)).rejects.toBeInstanceOf(CompilerError);
  });

  it('connection errors pass through', async () => {
    const boom = new Anthropic.APIConnectionError({ message: 'socket hang up' });
    const { client } = stub(async () => {
      throw boom;
    });
    await expect(client.complete(req)).rejects.toBe(boom);
  });
});

describe('bedrockModelId (F19)', () => {
  it.each([
    ['claude-sonnet-5-5', 'anthropic.claude-sonnet-5-5'],
    ['anthropic.claude-opus-5-5', 'anthropic.claude-opus-5-5'],
    ['us.anthropic.claude-sonnet-5-5', 'us.anthropic.claude-sonnet-5-5'],
    ['arn:aws:bedrock:us-east-1:123456789012:inference-profile/x', 'arn:aws:bedrock:us-east-1:123456789012:inference-profile/x'],
  ])('%s → %s', (model, id) => {
    expect(bedrockModelId(model)).toBe(id);
  });
});

describe('createBedrockClient (F19)', () => {
  const bedrockStub = (impl: (...args: unknown[]) => unknown) => {
    const create = vi.fn(impl);
    return { create, client: createBedrockClient({ mantle: { messages: { create } } as unknown as Pick<Anthropic, 'messages'> }) };
  };

  it('sends the Bedrock model id with the same body as Anthropic', async () => {
    const { create, client } = bedrockStub(async () => message({}));
    const m = message({});
    expect(await client.complete(req)).toEqual({ kind: 'output', text: '{"result":1}', stopReason: 'end_turn', raw: m.content });
    const body = create.mock.calls[0]![0] as Record<string, unknown> & { output_config: { format: Record<string, unknown> } };
    expect(body.model).toBe('anthropic.claude-sonnet-5-5');
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.messages).toHaveLength(3);
  });

  it('turns a missing region into a setup CompilerError, before any request', async () => {
    vi.stubEnv('AWS_REGION', '');
    vi.stubEnv('AWS_DEFAULT_REGION', '');
    vi.stubEnv('ANTHROPIC_BEDROCK_MANTLE_BASE_URL', '');
    try {
      const err = await createBedrockClient().complete(req).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(CompilerError);
      expect((err as Error).message).toMatch(/could not be set up: Bedrock needs an AWS region: set "awsRegion" in poltergeist\.config\.json, or AWS_REGION/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('maps a rejected credential to the credentials CompilerError', async () => {
    const { client } = bedrockStub(async () => {
      throw new Anthropic.PermissionDeniedError(403, { type: 'permission_error' }, 'no', new Headers());
    });
    await expect(client.complete(req)).rejects.toThrow(/rejected the credentials \(HTTP 403\)/);
  });
});

describe('createLlmClient (F19)', () => {
  it('provider bedrock really builds the Bedrock client (no region → the Bedrock setup error)', async () => {
    vi.stubEnv('AWS_REGION', '');
    vi.stubEnv('AWS_DEFAULT_REGION', '');
    vi.stubEnv('ANTHROPIC_BEDROCK_MANTLE_BASE_URL', '');
    try {
      await expect(createLlmClient({ provider: 'bedrock' }).complete(req)).rejects.toThrow(/Bedrock needs an AWS region/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.each(['anthropic', 'bedrock'] as const)('builds a %s client without touching the network', (provider) => {
    expect(createLlmClient({ provider, ...(provider === 'bedrock' ? { awsRegion: 'us-east-1' } : {}) }).complete).toBeTypeOf('function');
  });
});

describe('createOpenAiCompatibleClient (D-50)', () => {
  const chat = (over: Record<string, unknown> = {}, message: Record<string, unknown> = { content: '{"result":1}' }) =>
    new Response(JSON.stringify({ choices: [{ message, finish_reason: 'stop', ...over }] }), { status: 200 });
  const fake = (...responses: (Response | (() => Response))[]) => {
    const fetch = vi.fn(async () => {
      const r = responses.shift();
      if (!r) throw new Error('no more responses');
      return typeof r === 'function' ? r() : r;
    });
    return fetch as unknown as typeof globalThis.fetch & typeof fetch;
  };
  const groq = (fetch: typeof globalThis.fetch, env: NodeJS.ProcessEnv = { GROQ_API_KEY: 'gsk' }) =>
    createOpenAiCompatibleClient({ provider: 'groq', env, fetch, backoff: () => 0 });
  const openAiReq = { ...req, model: 'groq-x', turns: [{ role: 'user' as const, text: 'first' }, { role: 'assistant' as const, raw: '{"bad":1}' }, { role: 'user' as const, text: 'fix it' }] };
  const sent = (fetch: ReturnType<typeof vi.fn>, i = 0) => {
    const [url, init] = fetch.mock.calls[i] as [string, RequestInit];
    return { url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) as Record<string, unknown> & { messages: { role: string; content: string }[] } };
  };

  it('posts chat completions with the key, the turns, and the plan schema twice', async () => {
    const fetch = fake(chat());
    expect(await groq(fetch).complete(openAiReq)).toEqual({ kind: 'output', text: '{"result":1}', stopReason: 'stop', raw: '{"result":1}' });
    const { url, headers, body } = sent(fetch as unknown as ReturnType<typeof vi.fn>);
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(headers.authorization).toBe('Bearer gsk');
    expect(body.model).toBe('groq-x');
    expect(body.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(body.messages[0]!.content).toMatch(/^SYS\n\nAnswer with one JSON object only.*"result"/s);
    expect(body.messages[2]!.content).toBe('{"bad":1}');
    expect(body.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'test_plan' } });
    expect(body).not.toHaveProperty('meta');
  });

  it('uses Ollama without any key', async () => {
    const o = fake(chat());
    await createOpenAiCompatibleClient({ provider: 'ollama', env: {}, fetch: o }).complete(openAiReq);
    expect(sent(o as unknown as ReturnType<typeof vi.fn>).url).toBe('http://127.0.0.1:11434/v1/chat/completions');
    expect(sent(o as unknown as ReturnType<typeof vi.fn>).headers).not.toHaveProperty('authorization');
  });

  it('a missing key is a setup CompilerError before any request', async () => {
    const fetch = fake();
    const err = await groq(fetch, {}).complete(openAiReq).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CompilerError);
    expect((err as Error).message).toMatch(/GROQ_API_KEY is not set/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([401, 403])('HTTP %i → the credentials CompilerError, no retry', async (status) => {
    const fetch = fake(new Response('no', { status }));
    await expect(groq(fetch).complete(openAiReq)).rejects.toThrow(new RegExp(`rejected the credentials \\(HTTP ${status}\\)`));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries a free-tier 429 and a 503, then answers', async () => {
    const fetch = fake(new Response('slow down', { status: 429 }), new Response('busy', { status: 503 }), chat());
    expect((await groq(fetch).complete(openAiReq)).kind).toBe('output');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('gives up after 5 attempts and passes the error through (the pair becomes uncompilable)', async () => {
    const fetch = fake(...Array.from({ length: 5 }, () => () => new Response('slow down', { status: 429 })));
    const err = await groq(fetch).complete(openAiReq).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(CompilerError);
    expect((err as Error).message).toMatch(/groq returned HTTP 429: slow down/);
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it('a 400 is not retried', async () => {
    const fetch = fake(new Response('bad schema', { status: 400 }));
    await expect(groq(fetch).complete(openAiReq)).rejects.toThrow(/HTTP 400: bad schema/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('maps finish_reason length to max_tokens (the compiler\'s truncation)', async () => {
    const r = await groq(fake(chat({ finish_reason: 'length' }))).complete(openAiReq);
    expect(r).toMatchObject({ kind: 'output', stopReason: 'max_tokens' });
  });

  it('maps a refusal and a content filter to refusal', async () => {
    expect(await groq(fake(chat({}, { content: null, refusal: 'no thanks' }))).complete(openAiReq)).toEqual({ kind: 'refusal', detail: 'no thanks' });
    expect(await groq(fake(chat({ finish_reason: 'content_filter' }))).complete(openAiReq)).toEqual({ kind: 'refusal', detail: 'content_filter' });
  });

  it('an abort during the backoff stops the retry', async () => {
    const ac = new AbortController();
    const fetch = fake(new Response('slow down', { status: 429 }), chat());
    const client = createOpenAiCompatibleClient({ provider: 'groq', env: { GROQ_API_KEY: 'gsk' }, fetch, backoff: () => 60_000 });
    const p = client.complete({ ...openAiReq, signal: ac.signal });
    setTimeout(() => ac.abort(new Error('stop')), 10);
    await expect(p).rejects.toThrow('stop');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('createLlmClient routes groq and ollama here', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    try {
      await expect(createLlmClient({ provider: 'groq' }).complete(openAiReq)).rejects.toThrow(/GROQ_API_KEY is not set/);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
