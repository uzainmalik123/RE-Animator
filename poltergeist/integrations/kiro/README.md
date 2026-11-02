# Kiro integration templates

Files here are installed **into other projects'** `.kiro/` folders (D-01). `poltergeist init` (F13, D-41) fills them in and writes them for you:

```sh
npx poltergeist init --dir /path/to/your/project --target http://localhost:3000
```

It writes four files, never overwriting one that differs unless you pass `--force`. Your `poltergeist.config.json` is never replaced once it exists, and `--force` keeps the steering file's `## House rules` section:

| Template | Written to | What it does |
|---|---|---|
| `mcp.json` | `.kiro/settings/mcp.json` (merged; other servers are kept) | Kiro launches `poltergeist-mcp` over stdio. The agent gets `list_criteria`, `summon_ghosts`, `get_run_status`, `get_haunting_report` and `rehaunt`. The three read-only tools are auto-approved; the two that drive a browser ask first |
| `steering/poltergeist.md` | `.kiro/steering/poltergeist.md` | Tells the agent how to run the tests and fix what fails. Its `## House rules` section is for F17 |
| `hooks/poltergeist-summon.json` | `.kiro/hooks/poltergeist-summon.json` | After a spec task finishes (`PostTaskExecution`), asks the agent to run the tests. `--no-hook` skips it, `--spec <dir>` names one spec |
| n/a | `poltergeist.config.json` | A minimal config aimed at `--target` (loopback only, D-05). Add your routes and accounts |

## Copying by hand

- **Replace both placeholders in `mcp.json` with absolute paths.** One is the bin in your Poltergeist checkout. The other is `--root`, the project Kiro has open. Kiro doesn't document the working directory it spawns servers in, so `--root .` could widen the root to wherever that happens to be (D-38).
- **Don't use `npx poltergeist-mcp`.** The package isn't on npm yet (KI-33). Outside this repo's workspace, `npx` would fetch whatever package holds that name from the public registry, and run it without asking (Kiro's spawn isn't a TTY) with your API key in its env.
- **Replace `{{SPEC}}` in the hook prompt** with "the spec whose tasks just ran" or a spec folder.
- Kiro only expands `${ANTHROPIC_API_KEY}` once you've approved that variable. Facts and open questions: [`docs/kiro-notes.md`](../../docs/kiro-notes.md).
