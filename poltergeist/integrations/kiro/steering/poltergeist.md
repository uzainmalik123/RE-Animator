---
inclusion: always
---

# Poltergeist: adversarial acceptance tests

This project uses Poltergeist to check the running app against the acceptance criteria in each `.kiro/specs/<name>/requirements.md`. It runs scripted test users (double submits, unusual input, two tabs at once and so on) in a local browser, and writes `haunting-report.md` into the spec folder.

## Tools (MCP server `poltergeist`)

- `list_criteria`: the criteria Poltergeist found in a spec.
- `summon_ghosts`: run the tests for a spec. Long runs return a `runId`; poll `get_run_status` until it is done.
- `get_run_status`: progress or the final summary of a run.
- `get_haunting_report`: the board, or one criterion's failures with reproduction steps.
- `rehaunt`: re-run only the given criterion ids, after a fix.

## How to use it

1. Start the app on the `target` in `poltergeist.config.json` first. Tests only ever run against that local app.
2. Run the tests, read the report, fix the code for one failing criterion at a time, then confirm with `rehaunt`.
3. A criterion marked inconclusive or flaky is not a confirmed bug: say so instead of changing code for it.
4. Never edit `requirements.md`, `design.md` or `tasks.md` to make a test pass.

## House rules

<!-- Project-specific test rules go here. Poltergeist reads this section in a later release (F17); for now it is documentation only. -->
