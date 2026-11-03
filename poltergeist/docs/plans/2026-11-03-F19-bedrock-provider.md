# F19 Amazon Bedrock Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `poltergeist.config.json` choose `provider: "bedrock"` so the compiler runs the same Claude model through Amazon Bedrock in the user's own AWS account, with the provider in the plan cache key.

**Architecture:** `@anthropic-ai/bedrock-sdk`'s `AnthropicBedrockMantle` serves the Messages API (structured outputs included) and extends the Anthropic SDK's `BaseAnthropic`, so it plugs into the existing `createAnthropicClient({ anthropic })`. A new `createLlmClient({ provider, awsRegion })` picks the client; the Bedrock path maps `claude-*` model ids to `anthropic.claude-*`. Prompt, validation and retry (F05) are untouched.

**Tech Stack:** TypeScript/ESM, zod 4, vitest, `@anthropic-ai/bedrock-sdk` 1.1.1 (exact pin).

**Spec:** `docs/PRD.md` § F19; the grill rulings (D-47); `.kiro/specs/poltergeist/requirements.md` Req 2.1, 5.5.

## Global Constraints

- Pin dependencies exactly (`"@anthropic-ai/bedrock-sdk": "1.1.1"`); one deduped copy of `@anthropic-ai/sdk` (so `Anthropic.*Error` `instanceof` checks hold for Mantle errors).
- Config stays strict (unknown keys are errors). Secrets never go in config.
- LLM only at compile time; no prompt changes (D-03, D-09). F05 owns prompt content.
- Existing Anthropic configs, caches and reports must be byte-for-byte unaffected (no `provider` key emitted for `anthropic`).
- Tests never hit the network.
- `npm run health` green.

## Review Focus

1. `awsRegion` set with `provider: "anthropic"` → a ConfigError at `awsRegion`, not silently ignored (Task 1 test).
2. A model id that is already Bedrock-shaped (`anthropic.claude-…`, `us.anthropic.claude-…`, an ARN) → passed verbatim, never double-prefixed (Task 2 test).
3. A Bedrock client constructor failure (no region resolvable) → `CompilerError` "could not be set up", not a raw throw outside the try (Task 2 test).
4. A warm Anthropic cache + `provider: "bedrock"` → fresh LLM calls; the anthropic key is unchanged from today's (Task 3 test with a golden key).
5. The reset command must not see `AWS_BEARER_TOKEN_BEDROCK` (Task 4 test).

---

### Task 1: Config `provider` and `awsRegion`

**Files:**
- Modify: `packages/core/src/config/schema.ts` (ConfigSchema + superRefine)
- Test: `packages/core/test/config/schema.test.ts`

**Interfaces:**
- Produces: `Config['provider']: 'anthropic' | 'bedrock'` (default `'anthropic'`), `Config['awsRegion']?: string`; exported `LLM_PROVIDERS = ['anthropic','bedrock'] as const`, `type LlmProvider`.

- [ ] **Step 1: failing tests** — `it('defaults provider to anthropic')`: parsed minimal config → `provider === 'anthropic'`, no `awsRegion`. `it('accepts bedrock with a region')`: `{provider:'bedrock', awsRegion:'us-east-1'}` parses. `it('rejects awsRegion without bedrock')`: issue path `['awsRegion']`. `it('rejects an unknown provider')`: `provider:'openai'` fails. `it('rejects a malformed region')`: `awsRegion: 'US East'` fails (regex `^[a-z]{2}(-[a-z]+)+-\d+$`).
- [ ] **Step 2:** run `npx vitest run packages/core/test/config/schema.test.ts` → FAIL.
- [ ] **Step 3:** add `provider: z.enum(LLM_PROVIDERS).default('anthropic')`, `awsRegion: z.string().regex(...).optional()` next to `model`; superRefine adds `{path:['awsRegion'], message:'only used with provider "bedrock"'}`.
- [ ] **Step 4:** tests PASS. **Step 5:** commit `F19: config provider and awsRegion`.

### Task 2: `createBedrockClient` and `createLlmClient`

**Files:**
- Modify: `packages/core/src/compiler/llm.ts`, `packages/core/package.json` (dependency), root `package-lock.json`
- Test: `packages/core/test/compiler/llm.test.ts`

**Interfaces:**
- Consumes: `LlmProvider` (Task 1).
- Produces: `bedrockModelId(model: string): string`; `createBedrockClient(opts?: { awsRegion?: string; mantle?: Pick<Anthropic,'messages'>; maxTokens?: number }): LlmClient`; `createLlmClient(opts: { provider: LlmProvider; awsRegion?: string }): LlmClient`.

- [ ] **Step 1: failing tests** —
  - `bedrockModelId('claude-sonnet-5-5') === 'anthropic.claude-sonnet-5-5'`; `'anthropic.claude-opus-5-5'`, `'us.anthropic.claude-sonnet-5-5'`, `'arn:aws:bedrock:us-east-1:1:inference-profile/x'` unchanged.
  - `createBedrockClient({ mantle: stub })` sends `model: 'anthropic.claude-sonnet-5-5'`, the same `output_config.format.type === 'json_schema'`, the same mapped messages, and returns the same `LlmResponse` shape.
  - Without `mantle`, with `AWS_REGION`/`AWS_DEFAULT_REGION` unset and no `awsRegion` (use `vi.stubEnv`): `complete()` rejects with `CompilerError` matching `/could not be set up/` — and no network call (construction or the first request fails before sending; if the SDK defers the region check, guard it ourselves: no region → throw CompilerError `"Bedrock needs a region: set awsRegion in poltergeist.config.json or AWS_REGION"`).
  - `createLlmClient({provider:'anthropic'})` and `({provider:'bedrock', awsRegion:'us-east-1'})` each return an object with `complete` (no network; just shape).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** `npm i -w @poltergeist/core -E @anthropic-ai/bedrock-sdk@1.1.1`; check `npm ls @anthropic-ai/sdk` shows one deduped copy. Refactor `createAnthropicClient` to take a lazy `make: () => Pick<Anthropic,'messages'>` internally and a `mapModel` function, constructing inside the try so constructor errors become the setup `CompilerError`. `createBedrockClient` constructs `new AnthropicBedrockMantle({ awsRegion })` (region resolved `awsRegion ?? AWS_REGION ?? AWS_DEFAULT_REGION`, guard above) and `mapModel = bedrockModelId`.
- [ ] **Step 4:** PASS (whole `llm.test.ts`, existing anthropic tests unchanged). **Step 5:** commit `F19: Bedrock client through AnthropicBedrockMantle`.

### Task 3: Provider in the cache key, compile and summon wiring, artifacts

**Files:**
- Modify: `packages/core/src/compiler/cache.ts`, `compiler/compile.ts`, `summon/summon.ts`, `summon/types.ts` (doc comment), `report/schema.ts`, `report/render.ts`
- Test: `packages/core/test/compiler/cache.test.ts`, `packages/core/test/compiler/done-when.test.ts` (new F19 describe), `packages/core/test/report/*` (render header), `packages/core/test/summon/*` (run.json)

**Interfaces:**
- Consumes: `LlmProvider`, `createLlmClient` (Tasks 1–2).
- Produces: `CacheKeyInput.provider?: LlmProvider`; `compile` opts `provider?: LlmProvider` (default `'anthropic'`); `ReportJsonSchema.provider?: 'bedrock'`; render `run.provider?: LlmProvider`.

- [ ] **Step 1: failing tests** —
  - cache: a golden test that an input without `provider` and with `provider:'anthropic'` give the same key as today (compute the current key in the test before the change and hard-code it); `provider:'bedrock'` gives a different key.
  - done-when (F19): compile the fixture with a fake LLM and `provider:'anthropic'` into a cacheDir, then `provider:'bedrock'` with the same cacheDir → `llmCalls > 0`, `cacheHits === 0`; a second bedrock compile → `llmCalls === 0`.
  - render: with `provider:'bedrock'` the header contains `claude-sonnet-5-5 via Bedrock`; report JSON has `provider: 'bedrock'`; without it, no `provider` key and the header is unchanged.
  - summon: with config `provider:'bedrock'` (+ injected fake `llm`), `run.json` has `provider: 'bedrock'`; anthropic run.json has no `provider` key.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** in `cacheKey` push `['provider', k.provider]` only when `k.provider && k.provider !== 'anthropic'`; pass through compile; `summon` uses `opts.llm ?? createLlmClient(loaded.config)` and passes `provider` to compile, run.json and render (only when bedrock).
- [ ] **Step 4:** PASS. **Step 5:** commit `F19: provider in the cache key, run.json and report`.

### Task 4: Reset env, docs and spec

**Files:**
- Modify: `packages/core/src/config/reset.ts` (`PROVIDER_ENV_KEYS` += `'AWS_BEARER_TOKEN_BEDROCK'`), `packages/core/test/config/reset.test.ts`
- Modify docs: `.kiro/specs/poltergeist/requirements.md` (Req 2.1 adds provider/awsRegion; Req 5.5 adds provider), `design.md` (§3 config example comment, compiler line), `docs/PRD.md` (F19 Done (fixture), changelog), `.kiro/specs/poltergeist/tasks.md`, `docs/STACK.md` (Mantle, not client-bedrock-runtime), `docs/DECISIONS.md` (D-47), `docs/KNOWN_ISSUES.md` (KI-67 live Bedrock check), `integrations/kiro/README.md` (Bedrock env note), `.env.example` (commented AWS vars), `AGENTS.md` current state.

- [ ] **Step 1:** failing test: reset env drops `AWS_BEARER_TOKEN_BEDROCK`. **Step 2:** FAIL. **Step 3:** add the key. **Step 4:** PASS.
- [ ] **Step 5:** docs as listed. **Step 6:** `npm run health` → exit 0. **Step 7:** commit `F19: spec, decisions and docs (D-47, KI-67)`.
