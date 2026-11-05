# AGENTS.md — repo root (read this first)

This repository is the team's **Kiroween 2026** entry. It holds **two sibling projects**:

```
<repo root>/
  reanimator/    THE PRODUCT we submit (Frankenstein): a necromancer raises dead repos;
                 Death attacks what you revived; you heal it. All the UI, art and story.
  poltergeist/   THE ENGINE (headless): the red-team that powers "Death's attack".
                 Already built and tested. Reanimator calls it.
  .github/       CI (currently runs Poltergeist's health gate)
  .claude/       repo-wide skills: superpowers + grill-me/grilling
```

## Which project am I working on?

- **Work in `reanimator/`** for anything the user sees: the story, the art, the raise, Death's attack scene, the heal loop. Start with `reanimator/AGENTS.md`.
- **Work in `poltergeist/`** only for the engine itself (compiling/running the adversarial tests). Start with `poltergeist/AGENTS.md`.
- Each project has its own `docs/`, `.kiro/`, `AGENTS.md` and `CLAUDE.md`. When a session opens inside a subfolder, that subfolder's guide applies; this root file is the map.

## How they fit (the mash-up)

Reanimator revives a dead repo and serves it on localhost. Then it runs **Poltergeist** against that revived app (via Poltergeist's CLI/MCP) and draws the findings as "wounds" Death inflicted. The user heals them with Kiro and re-runs. See `reanimator/docs/STORY.md` and `reanimator/docs/PRD.md` (the mash-up diagram).

- **Submission:** one entry, **Reanimator**, in **Frankenstein**. Poltergeist is a component, not a separate submission.
- **The look:** the necromancer dot-matrix style (`reanimator/docs/THEME.md`). Poltergeist is headless here; its old standalone UI/costume is not used in the entry.

## Rules that apply across the whole repo

- **Fresh code only.** Nothing is copied from `../reanimator` (the earlier prototype) or `../poltergeist-old` — both predate the hacking window and are off-limits. Every line here is written inside the window (eligibility).
- **`npm run health` stays green** in each project, after every change. CI runs it.
- **Keep each project's `docs/DECISIONS.md` and `docs/KNOWN_ISSUES.md` current** every session (each AGENTS.md says how).
- **🔒 Some features are built in Kiro, not Claude Code** (Reanimator D-R18): Reanimator **R6, R8, R10** and Poltergeist **F10 Candy Swap** (D-10). A Claude Code session asked to build, plan or review one of them stops and reminds the user. They're done in the batched Kiro session near the demo.
- **Don't point the red-team at anything but the local app we revived.** It's QA/robustness testing of our own code (see `poltergeist/docs/DECISIONS.md` D-08).

## Tools

- `hackathon-ai-strategist` subagent (strategy, scope, pitch).
- Repo-wide skills: `superpowers` (grill → plan → implement → review) and `grill-me` / `grilling`.

## State (2026-11-05)

- `poltergeist/`: engine built through its F09 (spec reader, config/safety, scout, personas, compiler, runner, verdicts, report, CLI); tests green. Now consumed by Reanimator (its standalone Séance/Costume work is deprioritised — see `poltergeist/docs/DECISIONS.md`).
- `reanimator/`: R0 scaffold and R1 dot-matrix renderer done (`src/render/`). **R2 the raise is built** on our own practice corpse (D-R14): a real flatline, the remedy, four real vitals (install/build/serve/render), SSE to a spell-circle + heart-monitor scene, and a loopback guard on the backend (KI-R12). The team still has to approve the look (KI-R2). **R3 Death's attack is wired** (D-R16/D-R17): the Poltergeist CLI runs as a subprocess against the risen origin from the fixture's hand-written chart, and its haunted pairs come back as wounds over SSE to a **Summon Death** panel. The live run with a key is KI-R15. **R4 the attack scene is built** (D-R19): on Summon Death the stage shows the engine's own frames of the app in bone, Death and his minions at the ghosts' real positions in red, and a wound where each haunted pair struck. **R5 the heal loop is built** (D-R20): each wound has a brief to paste into Kiro and **Dare Death again**, which re-raises the body on real vitals and re-runs Death on that wound only; it closes only on a clean pair that really ran. **R7 the grimoire is built** (D-R21): spells run the real Kiro agent headless (`kiro-cli chat --output-format stream-json`, file tools only) on the revived body, drawn as quill, margin notes, ruled boxes, candle and seal; a wound can be cast from its brief and a sealed heal dares Death again. It's tested against a fake kiro-cli, and the live cast is KI-R21. **R11 the hosted replay is built** (D-R22): with `REANIMATOR_RECORD` the backend records the session's own streams and frames, and `?replay` / `npm run build:replay` plays them in the real UI, labelled "RECORDED RUN" with every control locked; a hand-run workflow deploys it to GitHub Pages. The real hero recording is KI-R23. **R9 any grave is built** (D-R23): a GitHub URL is cloned shallow, proven dead and raised in a bubblewrap sandbox by four fixed rites; the live run on a real repo is KI-R25. Next: KI-R15 (which also films R4), pick the demo repo (KI-R1), then one batched Kiro session that heals from the grimoire (KI-R19, KI-R21) **while recording** (KI-R23).
