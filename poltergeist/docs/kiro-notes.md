# Kiro notes (KI-06)

Facts about Kiro that Poltergeist builds on, each with its source and confidence. They were researched on **2026-11-01** for F11. **Re-check anything marked unverified in a real Kiro session** before F13 or F18 depends on it.

## MCP (F11): confirmed from the docs

Source: <https://kiro.dev/docs/mcp/configuration/> and <https://kiro.dev/docs/mcp/>

- **Config files:**
  - workspace `.kiro/settings/mcp.json`;
  - user `~/.kiro/settings/mcp.json`.
  - Both are merged, and the workspace wins.
- **Format:** the top-level key is `mcpServers`.
  - Local server fields: `command` (required), `args`, `env`, `disabled`, `autoApprove` (tool names) and `disabledTools`.
  - Remote servers use `url`, `headers` and `oauth`.
- **Env interpolation:** `"${VAR_NAME}"`. The IDE expands only variables the user has approved.
- **Transports:** stdio and Streamable HTTP/SSE.
- **Features:** tools, prompts and resources (through `#` mentions), and elicitation.
- **Tool names:**
  - must match `^[a-zA-Z][a-zA-Z0-9_]*$` (no hyphens or dots);
  - can be at most **64 chars including the server prefix**;
  - tools with an empty description are dropped;
  - descriptions over 10 000 chars trigger a warning.

## MCP: unverified

- **`cwd`** for a local server isn't documented, and neither is a `${workspaceFolder}`-style variable. That's why `poltergeist-mcp` takes `--root`, always as an absolute path (D-38).
- **Timeouts:**
  - the custom-agent reference (<https://kiro.dev/docs/custom-agents/configuration-reference/>) lists a per-server `timeout` (handshake, default 60 000 ms) and `requestTimeout` (per call, default 120 000 ms);
  - it's unknown whether the IDE honours them in `mcp.json`;
  - Poltergeist's tools long-poll for at most 100 s, and 50 s by default (D-38, KI-12).
- **Progress notifications:** not documented. Assume they're ignored.
- **Tool output size limit:** not documented. Poltergeist caps every result at 6 000 chars (D-38).

## Hooks (F13): from the docs, not yet seen firing (KI-51)

Source: <https://kiro.dev/docs/hooks/> and <https://kiro.dev/docs/hooks/types/>

- **Location:** JSON files in `.kiro/hooks/`, shaped `{"version":"v1","hooks":[{"name","trigger","matcher","action":{"type":"command"|"agent",…}}]}`.
- **Actions:** a `command` action gets context as JSON on stdin; an `agent` action injects a prompt.
- **IDE triggers:** Prompt Submit, Agent Stop, Session Start, Pre/Post Tool Use, File Create/Save/Delete, and Pre/Post Task Execution.
- **"Manual" triggers** existed only in IDE 0.x.
- The older `.kiro.hook` format isn't mentioned in the current docs.
- **Re-read 2026-11-02 (F13):** fields are `version` (`"v1"`), `hooks[]` with `name`, optional `description`, `trigger` (PascalCase), optional `matcher` (regex for file and tool triggers), `action` (`{type:"command",command}` or `{type:"agent",prompt}`), optional `timeout` (seconds, default 60), `enabled` (default true) and `confirm`. Trigger ids on the types page: `PromptSubmit`, `AgentStop`, `SessionStart`, `PreToolUse`, `PostToolUse`, `FileCreate`, `FileSave`, `FileDelete`, `PreTaskExecution`, `PostTaskExecution` (`Manual` only in CLI V3). The overview page's example uses `PostFileSave` and `Stop`, so the spellings aren't fully consistent; KI-51 checks the one `init` uses.
- **`poltergeist init` writes** `.kiro/hooks/poltergeist-summon.json`: one `PostTaskExecution` hook with an `agent` action (D-41).

## Powers (F18): from the docs, not yet installed (KI-65)

Researched 2026-11-03. Sources: <https://kiro.dev/docs/powers/>, <https://kiro.dev/docs/powers/create/>, <https://kiro.dev/docs/powers/installation/>, <https://github.com/kirodotdev/powers> (`power-builder/skills/agent-plugins-reference/SKILL.md`, `kiro-support/`, `neon/`, `localstack/`).

- **What it is:** a bundle of MCP tools and know-how that Kiro activates on demand. When a task mentions one of the Power's keywords, Kiro loads its context and tools. power-builder advises 5–7 specific keywords and warns against broad ones ("test", "api", "data").
- **Two formats:**
  - **Agent Plugins (recommended for new Powers):** `plugin.json` (required) + optional `mcp.json` at the root + `skills/<name>/SKILL.md` (one level deep only).
  - **Legacy:** `POWER.md` (frontmatter `name`, `displayName`, `description`, `keywords`, `author` string) + `mcp.json` + `steering/*.md`. Most powers in kirodotdev/powers still use it, and it "continue[s] to work".
- **`plugin.json`:**
  - `$schema` = `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`.
  - `name`: lowercase, 1–64, `a-z 0-9 - .`, no `--`/`..`, alphanumeric at both ends. Renaming may need a reinstall.
  - `version`, `description`, `author {name}` and `keywords` are required on kiro.dev; the spec only requires `$schema` and `name`, and ignores unknown fields. `displayName`, `license`, `repository` and `homepage` are optional.
- **`mcp.json` (plugin format):**
  - `$schema` = `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json`.
  - Each server needs `type` (`stdio`, `streamable-http`).
  - stdio takes `command`, `args`, `env` and `cwd`. `command` is one token: a bare name on PATH, or `./` relative to the plugin root. `cwd` defaults to the plugin root.
  - The spec expands only `${PLUGIN_ROOT}` and `${PLUGIN_DATA}`, in `args`, `env` and `cwd`. `env` must not set those two keys.
  - kiro.dev's create page also shows `"${API_KEY}"` user env vars (unverified at runtime).
  - A bad `mcp.json` disables MCP for that Power only; a bad server entry is skipped.
- **Server names are namespaced:** `power-<power>-<server>` (e.g. `power-supabase-supabase-local`). Kiro's 64-char tool-name limit counts the prefix.
- **`SKILL.md`:** frontmatter `name` (equals the folder) and `description` (≤ 1024). Optional: `license`, `compatibility`, `metadata`, `allowed-tools`.
- **Hooks:** the marketplace page says Powers can bundle hooks, but neither format documents how. Poltergeist's Power ships none; `init` writes the hook (D-41, D-46).
- **Install:**
  - from the marketplace;
  - from the Powers panel: "Add Custom Power", then "Import power from GitHub" (repo URL) or "Import power from a folder" (a folder with `plugin.json` or `POWER.md` at its root).
  - Importing a repo subfolder from GitHub isn't documented. Where installed Powers live on disk isn't documented either.
- **Poltergeist's Power (D-46):** `poltergeist power --out <dir>` writes `plugin.json`, `mcp.json` (`node <abs bin> --root-from-spec`) and `skills/poltergeist/SKILL.md`. Install it from a folder.

## Manual F11 check in Kiro (KI-46)

1. Start Candy Swap (`npm --prefix fixtures/candy-swap run dev`) once F10 exists (KI-44).
2. Open `fixtures/candy-swap/` as the Kiro workspace. Add `integrations/kiro/mcp.json`'s entry to `.kiro/settings/mcp.json`, replacing both placeholders with **absolute** paths: the bin, and `--root` set to the workspace (`…/fixtures/candy-swap`). Never use `--root .` (spawn cwd unknown) or `npx poltergeist-mcp` (it would resolve from public npm). Approve `ANTHROPIC_API_KEY`.
3. In the MCP panel, check that the five tools are listed and none is excluded.
4. Ask the agent: "summon the ghosts on the candy-swap spec". It should call `summon_ghosts`, poll `get_run_status` if needed, read `get_haunting_report` for a haunted id, fix the code, then call `rehaunt` with that id until it's clean.
5. Note in KI-06 and KI-12 whether any call timed out, and what Kiro's MCP log says about `requestTimeout`.
