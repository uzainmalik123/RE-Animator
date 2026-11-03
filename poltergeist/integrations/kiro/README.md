# Kiro integration templates

Files here are installed **into other projects'** `.kiro/` folders (D-01). `poltergeist init` (F13, D-41) fills them in and writes them for you:

```sh
npx poltergeist init --dir /path/to/your/project --target http://localhost:3000
```

It writes four files, never overwriting one that differs unless you pass `--force`. Your `poltergeist.config.json` is never replaced once it exists, and `--force` keeps the steering file's `## House rules` section:

| Template | Written to | What it does |
|---|---|---|
| `mcp.json` | `.kiro/settings/mcp.json` (merged; other servers are kept) | Kiro launches `poltergeist-mcp` over stdio. The agent gets `list_criteria`, `summon_ghosts`, `get_run_status`, `get_haunting_report` and `rehaunt`. The three read-only tools are auto-approved; the two that drive a browser ask first |
| `steering/poltergeist.md` | `.kiro/steering/poltergeist.md` | Tells the agent how to run the tests and fix what fails. Its `## House rules` section (`disable`, `forbid`, `note`) is read on every run (F17) |
| `hooks/poltergeist-summon.json` | `.kiro/hooks/poltergeist-summon.json` | After a spec task finishes (`PostTaskExecution`), asks the agent to run the tests. `--no-hook` skips it, `--spec <dir>` names one spec |
| n/a | `poltergeist.config.json` | A minimal config aimed at `--target` (loopback only, D-05). Add your routes and accounts |

## Copying by hand

- **Replace both placeholders in `mcp.json` with absolute paths.** One is the bin in your Poltergeist checkout. The other is `--root`, the project Kiro has open. Kiro doesn't document the working directory it spawns servers in, so `--root .` could widen the root to wherever that happens to be (D-38).
- **Don't use `npx poltergeist-mcp`.** The package isn't on npm yet (KI-33). Outside this repo's workspace, `npx` would fetch whatever package holds that name from the public registry, and run it without asking (Kiro's spawn isn't a TTY) with your API key in its env.
- **Replace `{{SPEC}}` in the hook prompt** with "the spec whose tasks just ran" or a spec folder.
- **Bedrock instead of Anthropic (F19):** set `"provider": "bedrock"` in `poltergeist.config.json`, then in `mcp.json` swap the `ANTHROPIC_API_KEY` entry for your AWS ones (`"AWS_BEARER_TOKEN_BEDROCK": "${AWS_BEARER_TOKEN_BEDROCK}"` or `AWS_PROFILE`, plus `AWS_REGION` unless the config has `awsRegion`).
- Kiro only expands `${ANTHROPIC_API_KEY}` once you've approved that variable. Facts and open questions: [`docs/kiro-notes.md`](../../docs/kiro-notes.md).

## Kiro Power (F18, D-46)

`power/` is a [Kiro Power](https://kiro.dev/docs/powers/) in the Agent Plugins format. Kiro loads its tools only when a task mentions Poltergeist (its keywords are `poltergeist`, `summon ghosts`, `haunting report`, `rehaunt`, `adversarial acceptance tests` and `haunt spec`). Build it for your checkout, then import the folder:

```sh
npx poltergeist power --out ~/poltergeist-power
```

In Kiro, open the Powers panel, choose **Add Custom Power → Import power from a folder**, pick that folder, and approve `ANTHROPIC_API_KEY`.

| File | What it does |
|---|---|
| `plugin.json` | Name, description and activation keywords |
| `mcp.json` | Runs `node <this checkout>/packages/mcp/bin/poltergeist-mcp.js --root-from-spec`. `power` fills in the absolute path; the committed template has a placeholder |
| `skills/poltergeist/SKILL.md` | Tells the agent how to run the tests and fix what fails |

- **One server for every project.** With `--root-from-spec`, each tool call's `specDir` must be the absolute path of a `<project>/.kiro/specs/<name>` folder. That project is the root for the call, and `poltergeist.config.json` is found from the spec folder up to it. A relative path, or a config outside the project, is refused.
- **No hook and no auto-approve.** Kiro asks before every tool call. For the after-task hook and the house rules, run `poltergeist init` in the project as well.
- **Rebuild after moving the checkout:** `--out` must be a new or empty folder, so build into a fresh one and import it again.
- It hasn't been installed in the Kiro IDE yet (KI-65). If Kiro rejects the format, the fallback is the legacy `POWER.md` layout (`docs/kiro-notes.md`).
