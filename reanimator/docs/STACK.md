# Reanimator: Stack

> Confirmed and pinned in R0 (D-R12, superseding D-R9). The teammate is vibe-coding, so prefer boring, well-documented choices the agent knows well.

## Summary

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript**, Node ≥ 22, ESM | Matches Poltergeist; the agent handles it well; Poltergeist is TS |
| Frontend | **Vite + React + TypeScript** | Fast dev, simple, lots of examples for the agent |
| The art renderer | **Canvas 2D** (plain, no library), per [THEME.md](THEME.md) §3 | Full control of the dot-matrix dither; no dependency |
| Styling | Plain CSS with the palette tokens from THEME §4 | Dark-only; the look is canvas, not CSS |
| Font | **JetBrains Mono** (Google Fonts, OFL) for glyph/text surfaces | Good monospace coverage |
| Backend | **Node + Hono** (or Express) | Runs revive (install/build/serve) and the Poltergeist attack, streams status to the UI |
| Revive sandbox (v1) | A temp working dir on the dev machine | Enough for one prepared, trusted repo (D-R6). Containers only if R9 happens |
| Red-team engine | **Poltergeist** (the sibling at `../poltergeist`) via its CLI `summon` / MCP | Already built; never re-implement it (D-R4, KI-R4) |
| Agent (for healing) | **Kiro** (and/or Claude Code) edits the revived repo | The "familiar"; this is the Kiro-integration story |
| Health gate | `npm run health` (typecheck + lint + test) + CI | Same discipline as Poltergeist |
| Tests | Vitest (unit, renderer snapshot) | Matches the sibling |

## How the pieces talk

```
React UI (canvas scenes) ──HTTP/WebSocket──> Node backend
                                              ├─ revive: run install/build/serve in a temp dir → vitals
                                              ├─ serve the revived app at http://localhost:<port>
                                              └─ attack: run Poltergeist against that origin → haunting-report.json
                                                        (Poltergeist = ../poltergeist, its CLI `summon` as a subprocess, D-R16)
UI reads vitals + report and draws the raise, Death's attack, and the wounds.
```

## SaaS / external

| Service | For | Required? |
|---|---|---|
| **Kiro** (Pro+ during the event) | The familiar: search, surgery, healing; the Kiro-integration story | **Yes** |
| **Anthropic API** | Poltergeist's compiler needs it (see the sibling's STACK) | **Yes** (via Poltergeist) |
| **GitHub** | Public repo + the dead repos revived | **Yes** |
| **Doppler** | Secrets, same as the sibling | Team convention |
| **YouTube** | The < 3-min demo video | **Yes** |
| **Devpost** | Submission | **Yes** |
| **E2B** (`npm run e2b:up`, D-R26) | A live hosted Reanimator in a sandbox, behind a keyed gate | Optional |
| GitHub Pages (static, `npm run build:replay`, hand-run workflow) | Hosted replay (R11, D-R22) | Med |

## AWS

- Same stance as Poltergeist: optional only (its Bedrock provider). Reanimator itself adds no required AWS. If a hosted replay wants AWS for the "it's a Kiro/AWS event" angle, S3 + CloudFront for the static replay is the cheap option (see Poltergeist D-12).

## Ports (suggested; avoid clashing with Poltergeist's 4000/6660/6661)

| Port | Service |
|---|---|
| 5173 | Vite dev server (Reanimator UI) |
| 7070 | Reanimator backend |
| random free | The revived app on 127.0.0.1 (served for the attack; chosen per ritual, D-R15) |

## System tools (R9, D-R23)

- **`git`** clones a named grave.
- **`bwrap`** (bubblewrap) sandboxes every command of a grave. Without it, graves are refused; the practice corpse still rises.

## Pinned versions

Pinned exactly in `reanimator/package.json` (R0, D-R12). Shared tools match Poltergeist.

| Package | Version | Kind |
|---|---|---|
| react, react-dom | 19.3.1 | runtime |
| hono | 4.13.16 | runtime |
| @hono/node-server | 2.1.5 | runtime |
| playwright-core | 1.64.1 | runtime (R2 render vital; needs `npx playwright-core install chromium` once per machine, CI installs it) |
| vite | 8.3.5 | dev |
| @vitejs/plugin-react | 6.2.1 | dev |
| typescript | 5.9.3 | dev |
| vitest | 4.1.12 | dev |
| eslint, @eslint/js | 9.39.1 | dev |
| typescript-eslint | 8.72.1 | dev |
| eslint-plugin-react-hooks | 7.1.1 | dev |
| globals | 17.14.0 | dev |
| tsx | 4.23.15 | dev |
| @types/node | 22.20.5 | dev |
| @types/react, @types/react-dom | 19.3.0 | dev |

`npm audit` reports a moderate `minimatch` advisory inside the ESLint chain. It's dev-only and the same chain Poltergeist pins; the suggested "fix" downgrades ESLint to 4. Left as is.
