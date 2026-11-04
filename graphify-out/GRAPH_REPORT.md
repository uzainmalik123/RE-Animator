# Graph Report - poltergeist  (2026-11-04)

## Corpus Check
- 318 files · ~219,888 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 11, .example 1, .css 1)

## Summary
- 2098 nodes · 5316 edges · 107 communities (98 shown, 9 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 144 edges (avg confidence: 0.87)
- Token cost: 765,954 input · 0 output

## Community Hubs (Navigation)
- CLI Args & Commands
- Spec Reader & Config Plans
- EARS Spec Parsing
- Ghost Runner Plan
- Kiro MCP Server Plan
- Actor Executor & Throttle
- CLI Done-When Tests
- Host Allowlist
- Config Errors & Reset
- Haunting Plan DSL Schema
- MCP Output Formatting
- Route Scout Hashing
- LLM Compiler Client
- Plan Cache
- Verdict Computation
- Assertions Evaluation
- Device Presets
- Runner Events & Safety
- Input Generators
- Core Package Deps
- House Rules & Rehaunt Diff
- Runner Test Fixtures
- Root Package Deps
- CLI Main & Recording
- Candy Swap & Report Rulings
- Compiler Test Fixtures
- Live Feed Reducer
- Foundational Decisions
- Replay & Export IO
- Test Builders
- Reanimator Dev Deps
- CLI Package Manifest
- Recording Timeline Export
- Poltergeist CI Workflow
- Reanimator CI Workflow
- Persona Decisions
- CLI Binary Tests
- Report Merge & Rows
- MCP Run Manager
- Poltergeist Design Spec
- Agent Guide & Lessons
- MCP Package Manifest
- Poltergeist PRD Features
- Network Guard Decisions
- Reanimator Art Style
- Config Loading
- Scout Login
- Verdict & Runner Decisions
- Report Rendering
- Death Attack Flow
- Kiro Integration Decisions
- Kiro Research Notes
- Live Feed & Recording Plans
- Lich Revenant Changeling Plans
- Headless Pivot & Costume
- Reanimator Kiro Spec
- Revive & Heal Requirements
- Poltergeist Requirements
- Scout & Target Decisions
- Poltergeist Stack
- Report Glyphs & Text
- Route Picking
- Poltergeist TS Config
- Reanimator Hono Backend
- ARIA Snapshot Capture
- Reanimator React Canvas
- Kiro Loop & Power
- Candy Swap Prep Checks
- Exit Codes & Smoke Tests
- Seance Server Tests
- Candy Spec Fixtures
- Reanimator Spec Fixture
- Barrier Synchronization
- Prompt Trimming
- Repo Root & Grill Skills
- Costume Theme
- Kiro Power Manifest
- Persona Registry
- Frames & Cursor Overlay
- Reanimator App TSConfig
- Reanimator Base TSConfig
- Persona Features
- Terminal Live Block
- Candy Check Tests
- Reanimator R0 Scaffold
- Death & Minions Story
- Reanimator Node TSConfig
- ESLint Config
- Conflict-Key Scheduler
- Heal Loop & Graveyard
- Reanimator Scripts
- Naughty Strings & Personas
- Runner & Network Guard Spec
- Vite Config
- Kiro MCP Template
- Power MCP Template
- Poltergeist TSConfig Root
- Costume Kit Requirement
- Poltergeist Tech Steering
- Reanimator TSConfig Root
- Poltergeist Structure Steering
- Hosted Demo Replay
- Node Engine Pin
- Reanimator Structure Steering
- Minimatch Audit Issue
- Sound & Atmosphere
- Autopsy Feature

## God Nodes (most connected - your core abstractions)
1. `Poltergeist Known Issues Log` - 69 edges
2. `Poltergeist Decisions Log` - 48 edges
3. `Poltergeist PRD` - 33 edges
4. `Poltergeist Design Document` - 31 edges
5. `newGuardedContext()` - 27 edges
6. `parseConfig()` - 26 edges
7. `runPair()` - 25 edges
8. `summon()` - 25 edges
9. `main()` - 23 edges
10. `startActor()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `Red-team only against local revived app (D-08)` --conceptually_related_to--> `Network Guard`  [INFERRED]
  AGENTS.md → poltergeist/.kiro/specs/poltergeist/design.md
- `decideVerdicts (dropped; superseded by computeVerdicts)` --semantically_similar_to--> `computeVerdicts`  [INFERRED] [semantically similar]
  poltergeist/docs/plans/2026-11-01-F08-haunting-report.md → poltergeist/docs/plans/2026-11-01-F07-verdicts.md
- `Repo Root AGENTS.md` --references--> `Grill-me Skill`  [EXTRACTED]
  AGENTS.md → .claude/skills/grill-me/SKILL.md
- `Poltergeist (headless red-team engine)` --references--> `Poltergeist Pipeline Architecture`  [INFERRED]
  AGENTS.md → poltergeist/.kiro/specs/poltergeist/design.md
- `list()` --calls--> `UsageError`  [EXTRACTED]
  poltergeist/packages/cli/src/args.ts → poltergeist/packages/core/src/summon/errors.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **summon pipeline: scout -> compile -> run -> verdicts -> report** — poltergeist_docs_decisions_route_scout, poltergeist_docs_decisions_ghost_compiler, poltergeist_docs_decisions_ghost_runner, poltergeist_docs_decisions_compute_verdicts, poltergeist_docs_decisions_haunting_report, poltergeist_docs_decisions_summon [EXTRACTED 1.00]
- **Kiro integration surfaces (MCP, init hook/steering, Power, house rules)** — poltergeist_docs_decisions_kiro, poltergeist_docs_decisions_mcp_server, poltergeist_docs_decisions_poltergeist_init, poltergeist_docs_decisions_kiro_power, poltergeist_docs_decisions_house_rules [EXTRACTED 1.00]
- **Real Candy Swap Done-when checks blocked on KI-44** — poltergeist_docs_known_issues_ki_44, poltergeist_docs_known_issues_ki_30, poltergeist_docs_known_issues_ki_34, poltergeist_docs_known_issues_ki_36, poltergeist_docs_known_issues_ki_38, poltergeist_docs_known_issues_ki_42, poltergeist_docs_known_issues_ki_49, poltergeist_docs_known_issues_ki_53, poltergeist_docs_known_issues_ki_59, poltergeist_docs_known_issues_ki_63, poltergeist_docs_known_issues_ki_68 [EXTRACTED 1.00]
- **Core haunting pipeline: spec to scout to compile to run to verdicts to report** — poltergeist_docs_prd_f01_spec_reader, poltergeist_docs_prd_f03_route_scout, poltergeist_docs_prd_f05_ghost_compiler, poltergeist_docs_prd_f06_ghost_runner, poltergeist_docs_prd_f07_verdicts, poltergeist_docs_prd_f08_haunting_report, poltergeist_docs_prd_f09_cli_summon [EXTRACTED 1.00]
- **Network guard design (D-17, D-18, D-22)** — poltergeist_docs_lessons_dead_proxy_backstop, poltergeist_docs_lessons_loopback_bypass_rule, poltergeist_docs_lessons_webrtc_block, poltergeist_docs_lessons_new_guarded_context [EXTRACTED 1.00]
- **Kiro integration surfaces (MCP, init+hook, Power, steering)** — poltergeist_docs_prd_f11_kiro_mcp_server, poltergeist_docs_prd_f13_kiro_installer, poltergeist_docs_prd_f18_kiro_power, poltergeist_docs_prd_f17_house_rules [INFERRED 0.85]
- **Ghost compiler pipeline (route pick, prompt, LLM, validate, cache)** — poltergeist_docs_plans_2026_10_31_f05_ghost_compiler_compile, poltergeist_docs_plans_2026_10_31_f05_ghost_compiler_pickroutes, poltergeist_docs_plans_2026_10_31_f05_ghost_compiler_prompt, poltergeist_docs_plans_2026_10_31_f05_ghost_compiler_llmclient, poltergeist_docs_plans_2026_10_31_f05_ghost_compiler_validateplan, poltergeist_docs_plans_2026_10_31_f05_ghost_compiler_cache [EXTRACTED 1.00]
- **Network guard safety layers** — poltergeist_docs_plans_2026_10_31_f02_config_safety_newguardedcontext, poltergeist_docs_plans_2026_10_31_f02_config_safety_allowlist, poltergeist_docs_plans_2026_10_31_f02_config_safety_compileforbidden, poltergeist_docs_plans_2026_10_31_f02_config_safety_classifyrequestfailure, poltergeist_docs_plans_2026_10_31_f02_config_safety_dead_proxy, poltergeist_docs_plans_2026_10_31_f02_config_safety_guardlaunchoptions [EXTRACTED 1.00]
- **Core personas (Wraith, Banshee, Doppelgänger)** — poltergeist_docs_plans_2026_10_31_f04_personas_generators_wraith, poltergeist_docs_plans_2026_10_31_f04_personas_generators_banshee, poltergeist_docs_plans_2026_10_31_f04_personas_generators_doppelganger, poltergeist_docs_plans_2026_10_31_f04_personas_generators_persona [EXTRACTED 1.00]
- **summon pipeline: run -> verdicts -> report** — poltergeist_docs_plans_2026_11_01_f09_cli_summon_summon, poltergeist_docs_plans_2026_11_01_f06_ghost_runner_runplans, poltergeist_docs_plans_2026_11_01_f07_verdicts_computeverdicts, poltergeist_docs_plans_2026_11_01_f08_haunting_report_renderreport, poltergeist_docs_plans_2026_11_01_f08_haunting_report_writereport [EXTRACTED 1.00]
- **Runner page helpers installed per guarded context** — poltergeist_docs_plans_2026_11_01_f06_ghost_runner_installholds, poltergeist_docs_plans_2026_11_01_f06_ghost_runner_installoverlay, poltergeist_docs_plans_2026_11_01_f06_ghost_runner_applythrottle, poltergeist_docs_plans_2026_11_01_f06_ghost_runner_startframes [EXTRACTED 1.00]
- **candy:check Done-when checks** — poltergeist_docs_plans_2026_11_01_f10_candy_swap_prep_runcandycheck, poltergeist_docs_plans_2026_11_01_f10_candy_swap_prep_checkspecshape, poltergeist_docs_plans_2026_11_01_f10_candy_swap_prep_checkresettiming, poltergeist_docs_plans_2026_11_01_f10_candy_swap_prep_checkdeterminism [EXTRACTED 1.00]
- **Extended persona library (Lich, Revenant, Changeling)** — poltergeist_docs_plans_2026_11_02_f16_lich_revenant_lich, poltergeist_docs_plans_2026_11_02_f16_lich_revenant_revenant, poltergeist_docs_plans_2026_11_03_f20_changeling_changeling [INFERRED 0.85]
- **Synthetic app-failure assertions from step probes** — poltergeist_docs_plans_2026_11_02_f16_lich_revenant_usable_assertion, poltergeist_docs_plans_2026_11_02_f16_lich_revenant_probeusable, poltergeist_docs_plans_2026_11_03_f20_changeling_reachable_assertion, poltergeist_docs_plans_2026_11_03_f20_changeling_probereachable [INFERRED 0.85]
- **Kiro integration surface (MCP server, init installer, Power)** — poltergeist_docs_plans_2026_11_01_f11_kiro_mcp_server_poltergeist_mcp, poltergeist_docs_plans_2026_11_02_f13_kiro_installer_poltergeist_init, poltergeist_docs_plans_2026_11_03_f18_kiro_power_kiro_power, poltergeist_docs_plans_2026_11_03_f18_kiro_power_root_from_spec [INFERRED 0.85]
- **Haunting pipeline: Spec Reader -> Scout -> Compiler -> Runner -> Verdicts -> Report** — poltergeist__kiro_specs_poltergeist_design_scout, poltergeist__kiro_specs_poltergeist_design_compile, poltergeist__kiro_specs_poltergeist_design_runplans, poltergeist__kiro_specs_poltergeist_design_computeverdicts, poltergeist__kiro_specs_poltergeist_design_renderreport, poltergeist__kiro_specs_poltergeist_design_summon [EXTRACTED 1.00]
- **Kiro integration surfaces (MCP, hook, steering, Power)** — poltergeist__kiro_specs_poltergeist_design_mcp_tools, poltergeist_integrations_kiro_readme_agent_hook, poltergeist_integrations_kiro_steering_poltergeist, poltergeist_integrations_kiro_readme_kiro_power, poltergeist_integrations_kiro_readme_poltergeist_init [EXTRACTED 1.00]
- **Spec Reader test fixtures** — poltergeist_packages_core_test_fixtures_spec_candy_fixture_requirements, poltergeist_packages_core_test_fixtures_spec_candy_swap_draft_requirements, poltergeist_packages_core_test_fixtures_spec_messy_requirements, poltergeist_packages_core_test_fixtures_spec_reanimator_requirements [INFERRED 0.85]
- **Backend ops: revive, attack, heal, recheck** — reanimator__kiro_specs_reanimator_design_revive, reanimator__kiro_specs_reanimator_design_attack, reanimator__kiro_specs_reanimator_design_heal, reanimator__kiro_specs_reanimator_design_recheck [EXTRACTED 1.00]
- **Death's six minions (Poltergeist personas)** — reanimator_docs_story_wraith, reanimator_docs_story_banshee, reanimator_docs_story_doppelganger, reanimator_docs_story_lich, reanimator_docs_story_revenant, reanimator_docs_story_changeling, reanimator_docs_story_death_antagonist [EXTRACTED 1.00]
- **Vertical slice features R0-R5** — reanimator_docs_prd_r0_scaffold, reanimator_docs_prd_r1_dot_matrix_renderer, reanimator_docs_prd_r2_the_raise, reanimator_docs_prd_r3_deaths_attack, reanimator_docs_prd_r4_attack_scene, reanimator_docs_prd_r5_wounds_heal_loop [EXTRACTED 1.00]

## Communities (107 total, 9 thin omitted)

### Community 0 - "CLI Args & Commands"
Cohesion: 0.05
Nodes (61): CliArgs, Command, HELP_TEXT, isCommand(), list(), OWNED, parseCliArgs(), applyInit() (+53 more)

### Community 1 - "Spec Reader & Config Plans"
Cohesion: 0.06
Nodes (59): Scaffold + F01 Spec Reader Implementation Plan, Criterion type, criterionHash, normalizeText, ParsedSpec {criteria, warnings}, parseRequirements, parseSpec, Spec fixtures (own spec, reanimator, candy-swap-draft, messy) (+51 more)

### Community 2 - "EARS Spec Parsing"
Cohesion: 0.06
Nodes (49): classifyEars(), FIELD, Keyword, trimClause(), SpecNotFoundError, criterionHash(), normalizeText(), blockText() (+41 more)

### Community 3 - "Ghost Runner Plan"
Cohesion: 0.07
Nodes (50): applyThrottle / THROTTLE_PRESETS, BarrierSet, blockAction (leak aborts run), Claims fixture (naive check-then-insert claim endpoint), conflictKeys, createEventSink (ndjson, frames, redaction), installHolds request holds, Ghost-cursor overlay (OVERLAY_COLOR #7dffb0) (+42 more)

### Community 4 - "Kiro MCP Server Plan"
Cohesion: 0.06
Nodes (54): F11 Kiro MCP Server Implementation Plan, capText / capIds output caps (MAX_TEXT 6000, MAX_IDS 20), D-38 F11 grill rulings, findConfig (walk up to poltergeist.config.json), integrations/kiro/mcp.json Kiro wiring template, docs/kiro-notes.md (researched Kiro MCP facts), MCP tools: list_criteria, summon_ghosts, get_run_status, get_haunting_report, rehaunt, poltergeist-mcp stdio MCP server (@poltergeist/mcp) (+46 more)

### Community 5 - "Actor Executor & Throttle"
Cohesion: 0.08
Nodes (40): PlanTarget, THROTTLE_PROFILES, LoadedConfig, ACTIONS, actionTarget(), ActorEnv, ActorRun, currentStep() (+32 more)

### Community 6 - "CLI Done-When Tests"
Cohesion: 0.09
Nodes (19): MainDeps, PATHS, PATHS, TEMPLATES, BIN, PATHS, tmp(), fakeLlm() (+11 more)

### Community 7 - "Host Allowlist"
Cohesion: 0.10
Nodes (28): DEFAULT_HOSTS, effectiveHosts(), isAllowedHost(), isDnsName(), isValidHostEntry(), normalizeHost(), ForbiddenMatcher, BlockReason (+20 more)

### Community 8 - "Config Errors & Reset"
Cohesion: 0.09
Nodes (28): ConfigIssue, ResetError, ResetErrorKind, ConfigWarning, REDACTED, Redactor, PROVIDER_ENV_KEYS, resetEnv() (+20 more)

### Community 9 - "Haunting Plan DSL Schema"
Cohesion: 0.08
Nodes (29): Actors, ActorsSchema, AssertionSchema, HTTP_METHOD, InputSchema, LlmOutput, LlmOutputSchema, PlanBody (+21 more)

### Community 10 - "MCP Output Formatting"
Cohesion: 0.15
Nodes (27): readReportJson(), capIds(), capText(), MAX_IDS, MAX_TEXT, summarize(), findConfig(), inside() (+19 more)

### Community 11 - "Route Scout Hashing"
Cohesion: 0.13
Nodes (28): BlockedRequest, routeHash(), scoutHash(), sha16(), sortedJson(), done(), empty(), firstLine() (+20 more)

### Community 12 - "LLM Compiler Client"
Cohesion: 0.10
Nodes (27): @anthropic-ai/sdk@1.3.0, CompileOptions, CompilerError, bedrockModelId(), createAnthropicClient(), createBedrockClient(), createLlmClient(), LlmClient (+19 more)

### Community 13 - "Plan Cache"
Cohesion: 0.11
Nodes (31): CachedResult, CachedResultSchema, cacheKey(), CacheKeyInput, personaHash(), readCache(), sha(), writeCache() (+23 more)

### Community 14 - "Verdict Computation"
Cohesion: 0.14
Nodes (27): PairResult, PersonaId, AssertionResult, PairRepResult, computeVerdicts(), CriterionVerdictRecord, key(), PRECEDENCE (+19 more)

### Community 15 - "Assertions Evaluation"
Cohesion: 0.11
Nodes (26): HauntingPlan, ForbiddenRule, api(), AssertEnv, ConsoleRecord, evaluate(), firstLine(), Outcome (+18 more)

### Community 16 - "Device Presets"
Cohesion: 0.10
Nodes (22): DEVICE_IDS, DeviceId, DevicePreset, DEVICES, getDevice(), UnknownGeneratorError, UnknownPersonaError, generate() (+14 more)

### Community 17 - "Runner Events & Safety"
Cohesion: 0.15
Nodes (25): ASSERT_POLL_MS, RunnerSafetyError, createEventSink(), EventSink, Actor, blank(), firstLine(), intOption() (+17 more)

### Community 18 - "Input Generators"
Cohesion: 0.13
Nodes (26): ARBITRARY, fastcheckValue(), Generator, GENERATORS, INFO, EMOJI, emoji(), empty() (+18 more)

### Community 19 - "Core Package Deps"
Cohesion: 0.09
Nodes (30): dependencies, @anthropic-ai/bedrock-sdk@1.1.1, fast-check@4.10.2, mdast-util-to-string@4.0.0, playwright-core@1.64.1, remark-parse@11.0.0, unified@11.0.5, zod@4.6.7 (+22 more)

### Community 20 - "House Rules & Rehaunt Diff"
Cohesion: 0.15
Nodes (21): isPersonaId(), diffVerdicts(), applyHouseRules(), EMPTY, HOUSE_RULES_HEADING, HouseRules, HouseRulesResult, MAX_NOTE_LENGTH (+13 more)

### Community 21 - "Runner Test Fixtures"
Cohesion: 0.16
Nodes (20): guardLaunchOptions(), contexts, env(), CANDIES, CLAIMS, ClaimsFixture, cookies(), FORM (+12 more)

### Community 22 - "Root Package Deps"
Cohesion: 0.08
Nodes (29): devDependencies, eslint@9.39.1, @eslint/js@9.39.1, tsx@4.23.15, @types/node@22.20.5, typescript@5.9.3, typescript-eslint@8.72.1, vitest@4.1.12 (+21 more)

### Community 23 - "CLI Main & Recording"
Cohesion: 0.20
Nodes (21): main(), message(), Out, Io, runExport(), runReplay(), playRecording(), allowedOrigin() (+13 more)

### Community 24 - "Candy Swap & Report Rulings"
Cohesion: 0.13
Nodes (22): Candy Swap demo app, Haunting Report (haunting-report.md/.json), Re-haunt merge and verdict diff (F14), KI-04 Candy Swap might not contain interesting bugs, KI-09 Judges may not be able to run a live haunting, KI-14 LLM cost and rate limits, KI-25 Glyph rendering performance, KI-28 npm audit findings in dev-only lint tooling (+14 more)

### Community 25 - "Compiler Test Fixtures"
Cohesion: 0.11
Nodes (22): Element, SPEC_DIR, CandyFixture, cookies(), CSR_LOGIN, HUGE, loginForm(), MARKET (+14 more)

### Community 26 - "Live Feed Reducer"
Cohesion: 0.20
Nodes (18): foldLive(), framePath(), initialLiveState(), reduceLive(), withLine(), stateAt(), TimelineEntry, LineStatus (+10 more)

### Community 27 - "Foundational Decisions"
Cohesion: 0.13
Nodes (12): Amazon Bedrock provider (AnthropicBedrockMantle), Poltergeist Decisions Log, EARS keyword parsing, Ghost Compiler (F05), Haunting Plan JSON DSL, Plan cache (content-hash key), KI-01 LLM may not reliably compile EARS criteria into plans, KI-03 Choosing which route a criterion belongs to (+4 more)

### Community 28 - "Replay & Export IO"
Cohesion: 0.15
Nodes (11): PlayOptions, DEFAULT_MAX_BYTES, ExportOptions, RecordingManifest, Recording, SummonEvent, A, B (+3 more)

### Community 29 - "Test Builders"
Cohesion: 0.21
Nodes (19): result(), ReportInput, criterion(), A, at(), compiled(), F, input() (+11 more)

### Community 30 - "Reanimator Dev Deps"
Cohesion: 0.12
Nodes (22): devDependencies, eslint@9.39.1, @eslint/js@9.39.1, tsx@4.23.15, @types/node@22.20.5, @types/react@19.3.0, @types/react-dom@19.3.0, typescript@5.9.3 (+14 more)

### Community 31 - "CLI Package Manifest"
Cohesion: 0.11
Nodes (21): bin, poltergeist, dependencies, playwright-core@1.64.1, @poltergeist/core@*, tsx@4.23.15, ws@8.22.0, devDependencies (+13 more)

### Community 32 - "Recording Timeline Export"
Cohesion: 0.20
Nodes (19): buildTimeline(), estimateFrameTimes(), FrameMark, timelineDuration(), checkOutDir(), exportRecording(), failedGhosts(), json() (+11 more)

### Community 33 - "Poltergeist CI Workflow"
Cohesion: 0.10
Nodes (20): defaults, run, runs-on, steps, jobs, health, name, on (+12 more)

### Community 34 - "Reanimator CI Workflow"
Cohesion: 0.10
Nodes (20): defaults, run, runs-on, steps, jobs, health, name, on (+12 more)

### Community 35 - "Persona Decisions"
Cohesion: 0.16
Nodes (16): Big List of Naughty Strings (filtered), Changeling keyboard-only persona, Deterministic input generators, Lich persona (small-slow device), Built-in ghost personas, reachable app assertion, Revenant persona (stale session), usable app assertion (+8 more)

### Community 36 - "CLI Binary Tests"
Cohesion: 0.14
Nodes (9): BIN, BIN, PATHS, McpArgs, parseMcpArgs(), runStdio(), USAGE, bin (+1 more)

### Community 37 - "Report Merge & Rows"
Cohesion: 0.19
Nodes (13): ReportVerdict, Row, usableRow(), VerdictChange, RenderedReport, CRITERION_VERDICTS, PAIR_VERDICTS, PairSchema (+5 more)

### Community 38 - "MCP Run Manager"
Cohesion: 0.14
Nodes (10): SummonOptions, RunProgress, RunSummary, phaseOf(), Run, RunBusyError, RunManager, StartOptions (+2 more)

### Community 39 - "Poltergeist Design Spec"
Cohesion: 0.18
Nodes (20): Poltergeist Design Document, buildTimeline / stateAt, compile() Ghost Compiler, computeVerdicts(), createLlmClient, diffVerdicts (F14 re-haunt merge), Haunting Plan DSL, PairVerdict type (+12 more)

### Community 40 - "Agent Guide & Lessons"
Cohesion: 0.16
Nodes (11): Poltergeist AGENTS.md, Keep DECISIONS/KNOWN_ISSUES current every session, Work cycle: grill, plan, implement, review, close, Poltergeist CLAUDE.md, Poltergeist Lessons from the prototype, F01 Spec Reader, F02 Target Config & Safety Allowlist, F03 Route Scout (+3 more)

### Community 41 - "MCP Package Manifest"
Cohesion: 0.12
Nodes (19): bin, poltergeist-mcp, dependencies, @modelcontextprotocol/sdk@1.32.2, playwright-core@1.64.1, @poltergeist/core@*, tsx@4.23.15, zod@4.6.7 (+11 more)

### Community 42 - "Poltergeist PRD Features"
Cohesion: 0.18
Nodes (17): Poltergeist PRD, F06 Ghost Runner, F07 Verdicts & Flake Filter, F08 Haunting Report, F09 CLI summon, F12 Live Feed (headless), F14 Re-haunt & Verdict Diff, F15 Recordings: export & replay (+9 more)

### Community 43 - "Network Guard Decisions"
Cohesion: 0.16
Nodes (12): House rules in steering, Network Guard (newGuardedContext), KI-17 Forbidden rules only check first request of redirect chain, KI-18 Guard reporting gaps, KI-19 resetCommand backgrounding keeps pipes open, KI-20 Unused account keeps literal env:NAME password, KI-21 F02 deferred review minors, KI-23 Chromium reports stopped redirect hop as original failure (+4 more)

### Community 44 - "Reanimator Art Style"
Cohesion: 0.14
Nodes (15): Requirement 4: The look, KI-R11 Canvas sizing, KI-R2 Art quality without original author, KI-R3 Render performance, KI-R6 Eligibility of a prototyped idea, App canvas component (.stage), sizeCanvas(cssWidth, cssHeight, dpr), R1 Dot-matrix renderer (+7 more)

### Community 45 - "Config Loading"
Cohesion: 0.21
Nodes (14): ConfigError, jsonErrorLocation(), loadConfig(), parseConfig(), rawSecrets(), redactLiteralPasswords(), resolvePassword(), usedAccounts() (+6 more)

### Community 46 - "Scout Login"
Cohesion: 0.20
Nodes (14): AccountConfig, remaining(), field(), firstLine(), isUnderLoginRoute(), login(), LoginFailure, LoginResult (+6 more)

### Community 47 - "Verdict & Runner Decisions"
Cohesion: 0.16
Nodes (12): computeVerdicts (F07), Doppelganger persona (race), Ghost Runner (F06), npm run health gate, summon() CLI orchestration (F09), KI-02 The oracle problem, KI-07 Race windows may be too narrow, KI-08 Frame streaming from 12 ghosts may be too heavy (+4 more)

### Community 48 - "Report Rendering"
Cohesion: 0.26
Nodes (16): earlier(), failedLine(), flakySection(), hauntedSection(), JsonPair, pairKey(), promise(), renderReport() (+8 more)

### Community 49 - "Death Attack Flow"
Cohesion: 0.18
Nodes (14): attack(origin), recheck(id) via --only, Chart (spec of revived app), Requirement 2: Death attacks the revived app, KI-R4 How Reanimator calls Poltergeist, KI-R5 Revived app needs a chart, KI-R9 Scene scope, Kiroween 2026 Frankenstein category (+6 more)

### Community 50 - "Kiro Integration Decisions"
Cohesion: 0.22
Nodes (12): Kiro IDE integration, Kiro Power (Agent Plugins bundle), Poltergeist MCP server (five tools), poltergeist init installer (F13), KI-06 Kiro hook schema, MCP config and Power format unverified, KI-12 Long-running MCP calls may time out, KI-46 F11 Done-when not run in Kiro, KI-48 F11 review minors (+4 more)

### Community 51 - "Kiro Research Notes"
Cohesion: 0.19
Nodes (16): Kiro notes (KI-06), Kiro hooks (.kiro/hooks, PostTaskExecution), Kiro MCP config (.kiro/settings/mcp.json), Kiro Powers (Agent Plugins format), Manual F11 check in Kiro (KI-46), Kiro MCP tool name rules (64 chars incl. prefix), 6000-char MCP result cap, poltergeist-mcp --root absolute path (+8 more)

### Community 52 - "Live Feed & Recording Plans"
Cohesion: 0.23
Nodes (16): F12 Live Feed (headless) Implementation Plan, D-40 F12 grill rulings, Hardened --seance event server (startEventServer), framePath frames/<ghostId>/<seq>.jpg, live.hello message (LIVE_PROTOCOL = 1), LiveState reducer (reduceLive/foldLive, @poltergeist/core/live), Reanimator R4 attack scene, run.started.runDir field (+8 more)

### Community 53 - "Lich Revenant Changeling Plans"
Cohesion: 0.20
Nodes (16): F16 Extended Personas: Lich & Revenant Implementation Plan, D-44 F16 grill decisions, Lich persona (slow small device), Origin-scoped logout step, probeUsable unusable-target probe, Revenant persona (stale session, two tabs), small-slow device preset (360x640, 4x CPU slowdown), Synthetic usable app assertion (+8 more)

### Community 54 - "Headless Pivot & Costume"
Cohesion: 0.17
Nodes (10): Haunted terminal costume (ASCII Bayer dither), Live Feed (reduceLive/foldLive LiveState), Reanimator (the submitted product), Recordings export/replay (F15), KI-26 ASCII may turn to mush after video compression, KI-27 Looking too similar to Reanimator, KI-49 F12 Live Feed not checked on Candy Swap, KI-50 F12 review minors (+2 more)

### Community 55 - "Reanimator Kiro Spec"
Cohesion: 0.35
Nodes (15): Reanimator Kiro design spec, Reanimator Kiro requirements spec, Reanimator Kiro tasks (implementation plan), Product steering, Tech steering, Reanimator AGENTS.md guide, Reanimator CLAUDE.md, Reanimator Decisions log (+7 more)

### Community 56 - "Revive & Heal Requirements"
Cohesion: 0.16
Nodes (10): revive(repo), Requirement 1: Raise a dead repo, Requirement 3: Wounds and healing, KI-R1 Choose the demo repo, KI-R8 Reviving arbitrary repos runs untrusted code, R2 The Raise, R9 Arbitrary GitHub URL revive, The revival loop (graveyard, ritual, Death, reckoning, healing, peace) (+2 more)

### Community 57 - "Poltergeist Requirements"
Cohesion: 0.20
Nodes (14): House rules (F17), poltergeist.config.json, Poltergeist Requirements Document, EARS acceptance criterion (N.M ids, D-16), Req 2: Target configuration and safety (F02), Req 4: Personas and inputs (F04, F16, F20), Req 8: Reporting (F08), Req 9: Command line (F09, F14) (+6 more)

### Community 58 - "Scout & Target Decisions"
Cohesion: 0.19
Nodes (7): Route Scout (F03), KI-05 2026 rules unconfirmed, KI-10 Test-account and login handling, KI-15 Playtest code may not count, KI-22 F03 deferred review minors, KI-24 Eligibility of a prototyped idea, KI-31 F03 rebuild review minors

### Community 59 - "Poltergeist Stack"
Cohesion: 0.25
Nodes (14): Poltergeist Stack, @anthropic-ai/sdk (claude-sonnet-5-5), @poltergeist/cli, @poltergeist/core, @poltergeist/costume, Doppler secrets, fast-check + Big List of Naughty Strings, @poltergeist/mcp (+6 more)

### Community 60 - "Report Glyphs & Text"
Cohesion: 0.34
Nodes (11): Assertion, Step, DRAFT_WORDMARK, VERDICT_GLYPHS, jsonPair(), describeAssertion(), describeStep(), describeTarget() (+3 more)

### Community 61 - "Route Picking"
Cohesion: 0.24
Nodes (10): MAX_ROUTES, pickRoutes(), routeTokens(), STOP_WORDS, tokenize(), ROUTES, HOME_DOWN, MARKET (+2 more)

### Community 62 - "Poltergeist TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess (+5 more)

### Community 63 - "Reanimator Hono Backend"
Cohesion: 0.20
Nodes (9): dependencies, hono@4.13.16, @hono/node-server@2.1.5, createApp(), port, DEFAULT_PORT, resolvePort(), hono (+1 more)

### Community 64 - "ARIA Snapshot Capture"
Cohesion: 0.31
Nodes (9): INTERACTIVE_ROLES, interactiveFromSnapshot(), LABELABLE_ROLES, parseAriaLine(), attachLabels(), Capture, captureRoute(), collectTestIds() (+1 more)

### Community 65 - "Reanimator React Canvas"
Cohesion: 0.24
Nodes (7): react@19.3.1, react-dom@19.3.1, App(), sizeCanvas(), root, react, react-dom

### Community 66 - "Kiro Loop & Power"
Cohesion: 0.23
Nodes (12): Kiro loop (init, hook, summon, rehaunt), MCP tools (list_criteria, summon_ghosts, get_run_status, get_haunting_report, rehaunt), Req 10: Kiro integration (F11, F13, F17, F18), Poltergeist Power Skill, Poltergeist Kiro Power skill usage, Kiro Integration Templates README, poltergeist-summon PostTaskExecution hook, Kiro Power bundle (F18, D-46) (+4 more)

### Community 67 - "Candy Swap Prep Checks"
Cohesion: 0.30
Nodes (10): Candy Swap poltergeist.config.json, checkDeterminism (canonical JSON dumps), checkResetTiming (< 1 s budget), checkSpecShape, KI-44 Candy Swap not built yet, F10 Candy Swap Prep Kit Implementation Plan, runCandyCheck (npm run candy:check), F10 Candy Swap brief for Kiro (+2 more)

### Community 68 - "Exit Codes & Smoke Tests"
Cohesion: 0.23
Nodes (4): exitCodeFor(), SummonResult, connect(), TOOLS

### Community 69 - "Seance Server Tests"
Cohesion: 0.18
Nodes (10): finished, frame, hello, lateJoin(), rep, repDone, servers, spawned (+2 more)

### Community 70 - "Candy Spec Fixtures"
Cohesion: 0.18
Nodes (11): Criterion type, Req 1: Reading specs (Spec Reader, F01), Candy Fixture Spec, Claiming candy (double claim / race), Proposing trades, Candy Swap Draft Spec, Accepting offers (concurrent accept), Freeform criterion: inventory never negative (+3 more)

### Community 71 - "Reanimator Spec Fixture"
Cohesion: 0.18
Nodes (11): Live Feed (reduceLive/foldLive), Req 11: Live Feed and Replay (F12, F15), Reanimator Requirements Fixture, Autopsy (Coroner agent), Benchmark (graveyard revival rate), Chart (Archivist spec + smoke tests), Live theater (SSE dashboard), Operating room (Docker OR) (+3 more)

### Community 72 - "Barrier Synchronization"
Cohesion: 0.27
Nodes (4): BarrierSet, Waiting, ActorName, pending

### Community 73 - "Prompt Trimming"
Cohesion: 0.33
Nodes (6): collapseLine(), collapseQuoted(), cut(), escLen(), TRIM_CHARS, trimForPrompt()

### Community 74 - "Repo Root & Grill Skills"
Cohesion: 0.24
Nodes (10): Grill-me Skill, Grilling Skill, Design tree / frontier interview rounds, Repo Root AGENTS.md, Fresh code only rule, Poltergeist (headless red-team engine), Reanimator (submitted product), Red-team only against local revived app (D-08) (+2 more)

### Community 75 - "Costume Theme"
Cohesion: 0.36
Nodes (6): F26 Costume Kit, Poltergeist Theme (the costume), Ghost sprites (one per persona), Possession and exorcism animations, prefers-reduced-motion accessibility, POLTERGEIST box-drawing wordmark

### Community 76 - "Kiro Power Manifest"
Cohesion: 0.20
Nodes (9): author, name, description, displayName, keywords, license, name, $schema (+1 more)

### Community 77 - "Persona Registry"
Cohesion: 0.22
Nodes (6): LIST, PERSONAS, compiled(), fail, pass, plan()

### Community 78 - "Frames & Cursor Overlay"
Cohesion: 0.31
Nodes (6): startFrames(), installOverlay(), moveCursor(), OVERLAY_COLOR, overlayScript(), THROTTLE_PRESETS

### Community 79 - "Reanimator App TSConfig"
Cohesion: 0.20
Nodes (9): compilerOptions, jsx, lib, module, moduleResolution, types, extends, include (+1 more)

### Community 80 - "Reanimator Base TSConfig"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, isolatedModules, noEmit, noUncheckedIndexedAccess, skipLibCheck, strict, target (+1 more)

### Community 81 - "Persona Features"
Cohesion: 0.28
Nodes (8): Six ghost personas (Wraith, Banshee, Doppelganger, Lich, Revenant, Changeling), F04 Core Personas & Input Generators, F05 Ghost Compiler (LLM to Plan DSL), F16 Extended Personas: Lich & Revenant, F19 Amazon Bedrock Provider, F20 Changeling Persona (keyboard-only), F23 LLM writes free-form Playwright code (Scrapped), @anthropic-ai/bedrock-sdk (AnthropicBedrockMantle)

### Community 83 - "Candy Check Tests"
Cohesion: 0.22
Nodes (6): dirs, DRAFT_SPEC, ENV, here, REAL_CONFIG, repoRoot

### Community 84 - "Reanimator R0 Scaffold"
Cohesion: 0.25
Nodes (6): KI-R12 Backend request origin checks, createApp() Hono app, reanimator-ci.yml workflow, R0 Scaffold, Hono backend on 127.0.0.1:7070, npm run health gate

### Community 85 - "Death & Minions Story"
Cohesion: 0.56
Nodes (8): The Banshee, The Changeling, Death (antagonist), The Doppelgänger, The Lich, The Revenant, The Wraith, Death and minion sprites

### Community 86 - "Reanimator Node TSConfig"
Cohesion: 0.22
Nodes (8): compilerOptions, lib, module, moduleResolution, types, extends, include, ./tsconfig.base.json

### Community 87 - "ESLint Config"
Cohesion: 0.29
Nodes (4): eslint-plugin-react-hooks@7.1.1, globals@17.14.0, eslint-plugin-react-hooks, globals

### Community 88 - "Conflict-Key Scheduler"
Cohesion: 0.36
Nodes (5): Job, runScheduled(), Deferred, deferred(), harness()

### Community 89 - "Heal Loop & Graveyard"
Cohesion: 0.32
Nodes (7): heal(finding), Requirement 5: The graveyard and the familiar, R5 Wounds + heal loop, R6 The graveyard, R7 The grimoire (agent surface), Kiro, the familiar, Grimoire = agent/chat/report metaphor

### Community 90 - "Reanimator Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, health, lint, server, test, typecheck

### Community 91 - "Naughty Strings & Personas"
Cohesion: 0.29
Nodes (7): Device presets (small-slow), Persona table (Wraith, Banshee, Doppelganger, Lich, Revenant, Changeling), Big List of Naughty Strings (blns.txt), Injection categories (script, SQL, server code, command, XXE, jinja2), Reserved and numeric strings, Scunthorpe problem strings, Unicode categories (RTL, emoji, zalgo, two-byte, trick unicode)

### Community 92 - "Runner & Network Guard Spec"
Cohesion: 0.33
Nodes (6): guardLaunchOptions, Network Guard, newGuardedContext, Run Events (WebSocket), runPlans() Ghost Runner, Req 6: Running (F06, F16)

### Community 93 - "Vite Config"
Cohesion: 0.40
Nodes (4): vite@8.3.5, @vitejs/plugin-react@6.2.1, vite, @vitejs/plugin-react

### Community 94 - "Kiro MCP Template"
Cohesion: 0.50
Nodes (3): ANTHROPIC_API_KEY, node, poltergeist

### Community 95 - "Power MCP Template"
Cohesion: 0.50
Nodes (3): ANTHROPIC_API_KEY, node, poltergeist

### Community 96 - "Poltergeist TSConfig Root"
Cohesion: 0.50
Nodes (3): extends, include, ./tsconfig.base.json

### Community 97 - "Costume Kit Requirement"
Cohesion: 0.67
Nodes (3): Costume Kit (@poltergeist/costume), Persona type, Req 12: Costume (F26, F22)

### Community 98 - "Poltergeist Tech Steering"
Cohesion: 0.67
Nodes (3): Tech Steering, npm run health gate (D-19), Poltergeist tech stack (TS/Node 22, Playwright, zod, Anthropic SDK, MCP SDK)

## Knowledge Gaps
- **76 isolated node(s):** `node`, `ANTHROPIC_API_KEY`, `node`, `ANTHROPIC_API_KEY`, `./tsconfig.base.json` (+71 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 505 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react-dom` connect `Reanimator React Canvas` to `Reanimator Dev Deps`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `node`, `ANTHROPIC_API_KEY`, `node` to the rest of the system?**
  _76 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CLI Args & Commands` be split into smaller, more focused modules?**
  _Cohesion score 0.05365686944634313 - nodes in this community are weakly interconnected._
- **Why does `@modelcontextprotocol/sdk` connect `CLI Binary Tests` to `MCP Package Manifest`, `MCP Output Formatting`, `Exit Codes & Smoke Tests`, `CLI Done-When Tests`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Should `Spec Reader & Config Plans` be split into smaller, more focused modules?**
  _Cohesion score 0.06377151799687011 - nodes in this community are weakly interconnected._
- **Should `EARS Spec Parsing` be split into smaller, more focused modules?**
  _Cohesion score 0.06103286384976526 - nodes in this community are weakly interconnected._
- **Should `Ghost Runner Plan` be split into smaller, more focused modules?**
  _Cohesion score 0.06688311688311688 - nodes in this community are weakly interconnected._