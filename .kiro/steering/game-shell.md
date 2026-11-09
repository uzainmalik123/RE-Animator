---
inclusion: always
---

# The game's shell (PRD SYS-09)

The game's terminal is **our own emulated shell, not bash**. Only these commands exist:

`ls cd pwd cat head tail grep awk sort uniq wc cut file sha256sum tar cp rm mkdir sqlite3 iptables systemctl ss whois ping nmap curl date history clear help man`

- Pipes (`|`) and `>` work. Nothing else from bash does: no `sudo`, editors, package managers, `docker`, `&&`, subshells or scripts.
- `sqlite3` is real SQLite on the game's copy of the Juice Shop database.
- When writing game code, tests or Kiro's in-game prompts, never assume a command outside this list exists.

This list must match the shell's exported command list (PRD KDEV-01 tests this). Change it only together with SYS-09 in the PRD.
