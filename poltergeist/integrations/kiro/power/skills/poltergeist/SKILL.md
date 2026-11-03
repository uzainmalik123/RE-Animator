---
name: poltergeist
description: Run Poltergeist's adversarial acceptance tests on a Kiro spec. Scripted test users (double submits, unusual input, two tabs at once, a slow small device, a stale session) drive the running local app in a browser for each acceptance criterion in requirements.md, then a report says which criteria fail and how to reproduce them. Use it to check a spec's criteria against the app, read the failures, fix the code and re-test.
---

# Poltergeist: adversarial acceptance tests

Poltergeist checks the running app against the acceptance criteria in a project's `.kiro/specs/<name>/requirements.md`. It runs scripted test users in a local browser and writes `haunting-report.md` into the spec folder.

## Tools (MCP server `poltergeist`)

Every tool takes `specDir`: the **absolute** path of the spec folder, for example `/home/me/shop/.kiro/specs/checkout`. A relative path is rejected, because this server is shared by every project. The project is the folder that holds `.kiro/`, and `poltergeist.config.json` is found from the spec folder up to it.

- `list_criteria`: the criteria Poltergeist found in a spec.
- `summon_ghosts`: run the tests for a spec. Long runs return a `runId`; poll `get_run_status` until it is done.
- `get_run_status`: progress or the final summary of a run.
- `get_haunting_report`: the board, or one criterion's failures with reproduction steps.
- `rehaunt`: re-run only the given criterion ids, after a fix.

## How to use it

1. The project needs a `poltergeist.config.json` whose `target` is the app's local address (loopback only). If it has none, run `node {{CHECKOUT}}/packages/cli/bin/poltergeist.js init --dir <project> --target <origin>` (ask the user for the target if you don't know it).
2. Start the app on that target first. Tests only ever run against that local app.
3. Call `summon_ghosts`, read the board with `get_haunting_report`, then fix the code for one failing criterion at a time and confirm it with `rehaunt` for that id.
4. A criterion marked inconclusive or flaky is not a confirmed bug: say so instead of changing code for it.
5. Never edit `requirements.md`, `design.md` or `tasks.md` to make a test pass.

## More

- `poltergeist init` (the command above) also adds an agent hook (run the tests after each spec task) and a steering file with project house rules (`disable`, `forbid`, `note`). This Power doesn't install either.
- Each browser run asks for approval first.
- One run at a time: this server is shared by every project, so while a run is going, starting another (in any project) returns its `runId` to wait on.
