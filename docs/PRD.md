# PRD: scenario one, end to end

> **This file is the source of truth for what gets built.** `docs/GAME_PLAN.md` explains the *why*; this file says *exactly what*. If code and this file disagree, the code is wrong.
>
> **Changing it:** nobody improvises in code. To change a feature, edit its row here and add a `docs/DECISIONS.md` entry saying why, **then** build it. Rows can change; they can't be skipped.
>
> **Numbers marked _(tune)_** are starting values. Playtests may change them through the same edit-then-build rule.

Deadline: **2026-12-04** (submission). Team of two. Decisions behind this file: D-03 to D-11.

---

## 0. How to read the registry

Every feature has one row with:

| Column | Meaning |
|---|---|
| **ID** | `ATK` Death's moves · `MIN` minions · `DEF` player actions · `KIRO` Kiro · `SYS` game systems · `UI` screens · `CON` content · `REC` recording |
| **Pri** | **M** must (the game isn't done without it) · **S** should (in the 23 days if must is done) · **X** stretch (after submission-ready) |
| **Done when** | A check anyone can run. If it can't be checked, the row isn't finished being written |
| **Status** | `planned` → `building` → `done` (Done-when passes and `npm run health` is green) |

All rows start `planned`. Update the status in the same PR that changes it.

---

## 1. Platform (D-03)

- **A hosted web page plus one small server.** The page is the game (React + Vite). The server runs `kiro-cli acp` with our `KIRO_API_KEY` and nothing else (D-04). The host is still to pick (KI-04).
- **Desktop only.** Below 1024 px wide, or on touch-only devices, a "play on a computer" screen shows instead.
- **No accounts, no saves.** Each run is self-contained.
- **The game works without the server.** If Kiro is unreachable, every Kiro feature falls back to rule-written text (KIRO-09). A judge never gets a broken game.
- **One run ≈ 10–12 minutes on Medium.** **1 real second = 30 game seconds** _(tune)_, so 12 minutes covers a 6-hour incident. The in-game clock shows game time.

---

## 2. The core loop

```
Menu → Scenario + difficulty → Briefing (timer) → Live incident → Ending → Post-incident report → Menu
```

During the live incident, three things happen at once:
1. **Death** (the Director, SYS-02) advances his attack chain by replaying recorded moves (ATK).
2. **Minions** (MIN) keep turning up and have to be closed too, but they're far easier than Death.
3. **The player** investigates and acts through the terminal and consoles (DEF), with **Kiro** (KIRO) helping at its own real pace.

---

## 3. Death's moves (ATK)

Target **Juice Shop** (OWASP), recorded once per move by us (REC). "Needs" are what must still be true for the Director to pick the move; "Gains" are what it gives Death. "Stopped by" lists the DEF rows that close the move; every move has at least one (SYS-17 tests this).

Juice Shop facts marked ⚠ get confirmed while recording; if one turns out false, the row changes before it's built (KI-03).

| ID | Stage | Move | Real request / tool | What the defender sees | ATT&CK | Needs | Gains | Stopped by | Pri |
|---|---|---|---|---|---|---|---|---|---|
| ATK-01 | 1 Scout | Directory scan | ffuf with a wordlist | Hundreds of `404`s per minute from one IP; user agent `Fuzz Faster U Fool` (Hard: hidden) | T1595.003 | — | `map` (knows `/ftp`, `/api`, `/rest`, `#/administration`) | DEF-06, DEF-12 (scanner rule) | M |
| ATK-02 | 1 Scout | Loot the exposed `/ftp` folder | `curl /ftp/acquisitions.md`; null-byte trick for `package.json.bak` | `200`s on `/ftp/*` files; `%2500` in a URL | T1213 | `map`; `/ftp` on | `secrets-leaked` (company docs); reveals tech stack | DEF-10 (`/ftp` off) | S |
| ATK-03 | 2 Break in | SQL injection on login | `POST /rest/user/login` with `' OR 1=1--` as the email | **One** successful admin login from a new IP, no failed attempts first (the injection is in the request body, so it isn't in the access log; the app log shows the odd email) | T1190 | `map` | `admin-session` | DEF-12 (SQLi rules), DEF-13 (login patch) | M |
| ATK-04 | 2 Break in | Guess the admin password | Hydra against the login with a short list (Juice Shop's admin password is `admin123`) | A burst of `401`s on `/rest/user/login`, then one `200` | T1110.001 | `map`; login not rate-limited | `admin-session`, `admin-password` | DEF-07 (login rate limit), DEF-16 (reset admin password) | M |
| ATK-05 | 2 Break in | Reset a user's password via the security question | `POST /rest/user/reset-password` with a guessable answer ⚠ | Password-reset requests for one customer, then a login as them | T1110 | `map`; password reset on | `user-session` | DEF-10 (reset off), DEF-08 (lock that account) | S |
| ATK-06 | 3 Admin | Register his own admin | `POST /api/Users` with `"role":"admin"` (mass assignment) | A new user created with role admin; admin-only requests from the same IP | T1136 | any foothold or `map` | `own-admin` (a real account in the DB) | DEF-10 (registration off), DEF-13 (registration patch), DEF-14 (delete account) | M |
| ATK-07 | 3 Admin | Reuse a stolen admin token | Replays the admin JWT from ATK-03/04 | Admin requests with the same `Authorization` token from a second IP | T1550.001 | `admin-session` | keeps admin after the password changes | DEF-09 (rotate signing key + revoke sessions). Changing the password alone does **not** stop it | S |
| ATK-08 | 4 Harvest | Dump customers through search | sqlmap on `/rest/products/search?q=` (UNION) | Hundreds of near-identical search requests with long encoded `q=`, huge response sizes; user agent `sqlmap` (Hard: random agent) | T1190, T1041 | `map` | **souls**: emails + password hashes | DEF-10 (search off), DEF-12 (SQLi rules; Death switches to sqlmap tamper scripts, which leak through on Medium/Hard), DEF-13 (search patch) | M |
| ATK-09 | 4 Harvest | Scrape users through the admin API | `GET /api/Users` with the admin token, page by page | Admin token pulling the full user list; large `200`s | T1213 | `admin-session` or `own-admin` | **souls** | DEF-08 / DEF-14 (on the account he uses), DEF-09 | M |
| ATK-10 | 4 Harvest | Walk other customers' baskets | `GET /rest/basket/1`, `/2`, `/3`… with one customer's token (IDOR) | One customer token reading many basket IDs in sequence | T1190 | `user-session` or any session | **souls**: orders, addresses | DEF-13 (basket ownership patch), DEF-08 | S |
| ATK-11 | 5 Dig in | Plant a hidden second admin | A second `POST /api/Users` with a staff-looking email (`support-ops@juice-sh.op`) | One more admin in the users table; looks like a staff account | T1136 | `admin-session` or `own-admin` | `hidden-admin` (foothold) | DEF-14 (only if found), DEF-02 to find it | M |
| ATK-12 | 5 Dig in | Take over a real customer | `GET /rest/user/change-password?new=…&repeat=…` with no current password ⚠ | A password change for a customer who isn't logged in from that IP | T1098 | any session | `hijacked-user` (foothold) | DEF-16 (force reset that user), DEF-13 (change-password patch) | S |
| ATK-13 | 5 Dig in | Plant a file | Complaint upload at `/file-upload` with a type-check bypass ⚠. It can't execute on Juice Shop; it's a marker of compromise and a lure | A `.pdf`/`.zip` upload whose content isn't a PDF; a new file in uploads | T1105 | any session | `planted-file` (foothold) | DEF-15 (delete), DEF-10 (uploads off) | M |
| ATK-14 | 5 Dig in | Forge his own login token | An unsigned JWT (`alg: none`) for a made-up user ⚠ | Requests with a token whose header says `none`, from an account that doesn't exist | T1606 | `map` + `secrets-leaked` or a stage-3 gain | `forged-token` (foothold) | DEF-13 (token-verify patch). Rotating the key does **not** stop it | S |
| ATK-15 | 6 Strike | Deface products | `PUT /api/Products/:id` changing descriptions to his message | Product descriptions changed by an admin account; customers see it | T1491.002 | `admin-session` or `own-admin` or `hidden-admin` | `defaced` (heavy heartbeat drain) | DEF-17 (restore), DEF-13 (product-update patch) | M |
| ATK-16 | 6 Strike | Booby-trap a product page | Stored XSS in a product description through the API ⚠ | A `<script>`/`<iframe>` in a product description | T1189 | same as ATK-15 | `xss-live` (heartbeat drain; souls drip from customers who visit) | DEF-17, DEF-13 | S |
| ATK-17 | 6 Strike | Ransom note | Uploads `READ_ME_MORTAL.txt` and defaces the front banner with his demand | The note in uploads and on the home page | T1491.002 | any admin gain | `ransom` (ends his chain: the finale) | DEF-17, DEF-15, DEF-20 | M |

**Must = 10 moves, should = 7.** Every move keeps 2–3 recorded **variants** (different source IP, loud vs quiet user agent, different pacing) so blocking an IP or a signature doesn't simply end him (REC-03).

### 3.1 Death's taunts
Pre-written lines, never an LLM (D-11): **at least 3 per move**, plus lines for "you blocked me", "you tipped me off", "banished" and "I'm back". CON-04.

---

## 4. Minions (MIN, D-09)

Minions are **real background attackers**: the bots every internet-facing server gets. Unlike Death, each minion **does real damage if ignored** and **comes back in waves**, so the player has to keep dealing with them ("it's these guys again"). Each is closed with **one** correct action, which is the difference from Death.

| ID | Minion (look) | Real behaviour | Damage if ignored | Closed by | Waves (Medium) _(tune)_ | Pri |
|---|---|---|---|---|---|---|
| MIN-01 | **Crawlers** (skittering rats) | WordPress/PHP exploit scanners: `/wp-admin`, `/.env`, `/phpmyadmin` | Small heartbeat drain from load; clutters the logs | DEF-12 (scanner user-agent rule) or DEF-06 per IP | every ~2 min | M |
| MIN-02 | **Wraith swarm** (wisps) | Credential stuffing: leaked email/password pairs against `/rest/user/login` from many IPs | Steals 1 soul per success (customers who reused passwords) | DEF-07 (login rate limit); blocking IPs one by one doesn't work (many IPs) | every ~3 min | M |
| MIN-03 | **Gnawer** (a fat grub) | A scraper hammering `/api/Products` | Heartbeat drain from slowdown | DEF-12 (rate limit on `/api/*`) | every ~4 min | S |
| MIN-04 | **Poltergeist** (a flicker) | Spam bot posting to `/api/Feedbacks` | Heartbeat drain (customers see spam) | DEF-10 (feedback CAPTCHA on) | every ~5 min | S |

A closed minion type stays closed until a variant gets round it (e.g. MIN-01 returns with a new user agent on Hard). **Easy:** Kiro offers to close a minion for you (KIRO-04). **Hard:** more waves, and Death can hide a move inside a minion wave (SYS-02 pacing).

---

## 5. The player's actions (DEF)

Actions happen in two places, as in a real job:
- **The terminal** (SYS-09): investigation and server work, in real commands.
- **Consoles**: what real teams do through a web console, i.e. the WAF (web application firewall), feature flags, deploys, backups and comms.

"Cost" is the real-world downside. Game time for each action counts against the clock.

| ID | Phase | Action | Where / real syntax | Effect | Cost | Pri |
|---|---|---|---|---|---|---|
| DEF-01 | Investigate | Search logs | `grep`, `tail`, `awk`, `sort \| uniq -c` on `/var/log/nginx/access.log`, `/var/log/juice-shop/app.log` | Shows the real recorded lines | Game time | M |
| DEF-02 | Investigate | Inspect accounts | `sqlite3 /srv/juice-shop/data/juiceshop.sqlite "SELECT …"` (real SQLite, SYS-09) | Reveals admins, new users, password changes | Game time | M |
| DEF-03 | Investigate | Inspect files | `ls -la`, `cat`, `file`, `sha256sum` in `/srv/juice-shop/uploads` | Finds planted files (ATK-13, ATK-17) | Game time | M |
| DEF-04 | Investigate | Look up an IP | **Passive** `whois <ip>` (safe) vs **active** `ping`/`nmap`/`curl <attacker>` | Shows owner/ASN | Active lookups **tip Death off**: he speeds up a stage (SYS-02) | S |
| DEF-05 | Preserve | Snapshot evidence | `tar czf /evidence/<name>.tgz /var/log …` then `sha256sum` | Marks evidence preserved before changes | Game time. Skipping it before eradication is marked down in the report | M |
| DEF-06 | Contain | Block an IP | `iptables -A INPUT -s <ip> -j DROP` (`-L`, `-D` too) | Cuts that IP | Death **switches IP** (variant); you lose that thread in the logs | M |
| DEF-07 | Contain | Rate-limit login | WAF console → rate limit on `/rest/user/login` | Stops ATK-04 and MIN-02 | Small heartbeat cost (real customers slowed) | M |
| DEF-08 | Contain | Lock an account | `sqlite3 … UPDATE Users SET isActive=0 …` ⚠ or the Accounts console | That account stops working | Tips Death off; the real user is locked out | M |
| DEF-09 | Contain | Revoke all sessions + rotate the signing key | Sessions console | Kills stolen tokens (ATK-07) | Logs **every** customer out: heartbeat dip. Too early (before you know his footholds) is marked down | M |
| DEF-10 | Contain | Turn a feature off | Feature-flags console: search, registration, password reset, uploads, `/ftp`, feedback CAPTCHA (on) | Closes that route | Heartbeat drain **while off** (scaled by how important the feature is) | M |
| DEF-11 | Contain | Pull the plug | `systemctl stop nginx` (or the big red console button) | Stops everything | Heartbeat drains fast while down | M |
| DEF-12 | Eradicate | WAF rule (virtual patch) | WAF console: SQLi rule set, block user agent, block path, rate limit a path | Blocks a pattern fast | Leaky: Death's quiet variants get through (Medium/Hard) | M |
| DEF-13 | Eradicate | Deploy a code patch | Deploy console: review the real vulnerable Juice Shop code and the fix diff (drafted by Kiro or picked), then deploy | Closes the hole for good | Slow (≈ 20 game-min _(tune)_), brief restart dip in heartbeat | M |
| DEF-14 | Eradicate | Delete a rogue account | `sqlite3 … DELETE FROM Users WHERE …` or the Accounts console | Removes the foothold | Delete a real staff account by mistake → heartbeat hit | M |
| DEF-15 | Eradicate | Delete a planted file | `rm <path>` | Removes the foothold | Without DEF-05 first, the evidence is gone | M |
| DEF-16 | Eradicate | Force a password reset | Accounts console (one user) | Ends ATK-04/ATK-12 footholds for that user | That user is inconvenienced (tiny heartbeat cost) | M |
| DEF-17 | Recover | Restore from backup | Backups console: hourly snapshots with timestamps | Undoes defacement, rogue accounts, files | Restoring a backup taken **after** a foothold restores the foothold | M |
| DEF-18 | Recover | Bring things back | `systemctl start nginx`, flags back on | Ends self-inflicted downtime | Too early (a route still open) and he walks back in | M |
| DEF-19 | Communicate | Escalate to the incident lead | Comms console | The lead acknowledges; required before pulling the plug without a report penalty | Game time | S |
| DEF-20 | Communicate | Notify (legal / customers) | Comms console | Meets the notification clock (SYS-14) | Game time; notifying before confirming a breach is marked down | S |

**Must = 18, should = 2.** Difficulty only changes how the actions are reached (SYS-08), never what they do.

---

## 6. Kiro (KIRO, D-04, D-05)

Real Kiro, through `kiro-cli acp` on our server, **on rails**: our rules decide *what* Kiro may do; Kiro does the talking and drafting. **Kiro is slow the way real assistants are**, and the game doesn't pause for it. Asking Kiro is a real decision under time pressure, not a free answer.

| ID | Feature | Behaviour | Done when | Pri |
|---|---|---|---|---|
| KIRO-01 | **Chat** | The player asks anything. Kiro answers using read-only game tools (KIRO-07). The panel shows "Kiro is reading the logs…" for the real time it takes; the game clock keeps running | A question about a visible log line gets an answer that cites that line; Death keeps moving while Kiro thinks | M |
| KIRO-02 | **Draft a script** | Kiro writes commands the player then has to run themselves (paste or type into the terminal and decide where). Every line is checked by our shell's parser before it's shown (KIRO-08) | A draft containing a command we don't support never reaches the player | M |
| KIRO-03 | **Hints** | Rules decide **when** and **how much** (by difficulty, SYS-08); Kiro phrases them. Kiro never volunteers the action that closes one of Death's moves | On Medium, no hint before the player has been stuck for the threshold; hint text never contains a full fix for an ATK row | M |
| KIRO-04 | **"Kiro, apply it"** (Easy only) | On Easy, the player can tell Kiro to run its own draft or to close a minion. Never automatic, never on Medium/Hard | The button doesn't exist on Medium/Hard; on Easy, nothing runs without the click | M |
| KIRO-05 | **Explain this line** | Hover (Easy) or ask (Medium/Hard) for a plain-words explanation of a log line | Every recorded line type has a fallback explanation (CON-05) | S |
| KIRO-06 | **The debrief** | Kiro writes the post-incident report around the facts and grades computed by SYS-11; it can't change them | The facts and grades in Kiro's text match SYS-11's output exactly (checked by a test that diffs the numbers) | M |
| KIRO-07 | **Game tools for Kiro** | Read-only tools: current alerts, search logs, list accounts, list files, meters, recent player actions, the command list. No write tools | Kiro's agent config lists only these tools; a write attempt is impossible, not just refused | M |
| KIRO-08 | **Command guard** | Kiro's agent prompt states that only our command set exists (SYS-09) and what each does; the server also parses every drafted line and strips anything unsupported | A test feeds Kiro-style drafts with `sudo`, `vim`, `docker`, `curl \| bash` and none survive | M |
| KIRO-09 | **Fallback** | If Kiro times out (≈ 25 s _(tune)_), fails or the budget runs out, the rule-written version of the hint/draft/debrief shows, labelled "Kiro (offline)" | With the server stopped, a full run completes with every Kiro panel working | M |
| KIRO-10 | **Credit budget** | A per-run cap on Kiro calls and a daily cap on the server; the server logs the credits each call uses | Caps are enforced; the log shows credits per call (needed for KI-02) | M |
| KIRO-11 | **Kiro upgrades** | Unlockable Kiro abilities across scenarios | — | X |

**Credit maths:** 4000 credits for the team's testing, judges and the demo. The per-run cap gets set once KI-02 measures a real call's cost; the target is **≤ 40 credits per run** (≈ 100 runs).

---

## 7. Systems (SYS)

| ID | System | Spec | Done when | Pri |
|---|---|---|---|---|
| SYS-01 | **Game clock** | 1 real s = 30 game s _(tune)_; pausable only on Easy | Clock runs at the set ratio; pause key does nothing on Medium/Hard | M |
| SYS-02 | **The Director** | Every 3 real s _(tune)_ it looks at the world state and picks the next ATK move whose Needs hold, preferring later stages. Pacing: if the player has more than 3 open alerts, delay the next move; if fewer than 1 for 60 s, bring it forward. Tip-off (DEF-04 active, DEF-08) skips one wait. Deterministic for a given seed | A seeded run produces the same move sequence every time | M |
| SYS-03 | **Replay engine** | Plays a recording's events into the virtual logs/DB/files at game speed. If an action cuts the move mid-way (e.g. DEF-06 on its IP), the rest of that recording stops and the Director picks the next variant | Blocking the IP mid-ATK-08 stops new lines from that IP within one tick | M |
| SYS-04 | **World state** | One typed model: accounts, sessions, signing key, files, feature flags, firewall rules, WAF rules, backups, Death's gains, footholds, evidence | Every DEF and ATK reads/writes only through it | M |
| SYS-05 | **Souls** 💀 | Total = the customer records in the recorded DB _(count set by REC-04)_. Stolen records never come back. All taken → loss | The number shown equals the stolen rows replayed so far | M |
| SYS-06 | **Heartbeat** 🫀 | Starts at 100. Per game minute _(tune)_: −1 per **open door Death is actively using**, −0.5 per active minion, −(feature weight) per disabled feature, −4 while the plug is pulled, −3 while defaced/XSS live. Recovers +1 per game minute while nothing drains. Never above 100. 0 → loss (flatline) | A test with only "plug pulled" flatlines at the expected minute | M |
| SYS-07 | **Banishment and the return** | Win when Death has no move whose Needs hold **and** no foothold is left. If a foothold is left when his routes close, he goes quiet, then **returns** after 2 real minutes _(tune)_ through it | Leaving ATK-11's admin in place always triggers the return | M |
| SYS-08 | **Difficulty dials** | The table in GAME_PLAN §8, plus: Easy = consoles have buttons for terminal actions and KIRO-04; Medium = consoles + terminal; Hard = consoles + terminal, no suggestions, quiet ATK variants, more MIN waves. Same recordings and same report verdict on all | Switching difficulty changes only dial values (a test diffs two configs) | M |
| SYS-09 | **The shell** | Our own. Commands: `ls cd pwd cat head tail grep awk sort uniq wc cut file sha256sum tar cp rm mkdir sqlite3 iptables systemctl ss whois ping nmap curl date history clear help man`. Pipes and `>` supported. `sqlite3` is real SQLite (sql.js) on the recorded DB. Virtual file system filled by SYS-03. Anything else: `command not found` | Each command has tests for its supported flags; the command list is exported for KIRO-08 | M |
| SYS-10 | **Event log** | Every Death move, minion wave, player action and Kiro call, timestamped in game time | The report and the sim tests read only from it | M |
| SYS-11 | **Report grading** | Rules over SYS-10: time to notice each stage, time to contain, souls lost, downtime caused, evidence preserved before eradication, footholds missed, IP whack-a-mole (≥ 3 IP blocks on Death), early full logout, notification on time. A grade per phase (detect, contain, eradicate, recover) | Each rule has a test with a crafted event log | M |
| SYS-12 | **Kiro server** | Node server; one `kiro-cli acp` session per run (with KIRO-07 tools as an MCP server); session token per run; caps (KIRO-10); `KIRO_API_KEY` from `.env` | Runs locally with one command; refuses calls without a run token | M |
| SYS-13 | **Struggle detector** | "Struggling" = souls fell > 10 % in the last 2 real minutes, or no useful action for 90 real s _(tune)_. On Medium/Hard it unlocks one suggestion in the terminal | Sim test: an idle player on Medium gets exactly one suggestion per struggle window | M |
| SYS-14 | **Notification clock** | Starts when the player confirms a breach (first DEF-05 or DEF-19 after souls are taken); 72 game hours (GDPR) compressed to the run length _(tune)_ | Report marks late or missing notification | S |
| SYS-15 | **Demo mode** | A fixed seed plus a fixed player script for the trailer | Two demo runs produce identical event logs | S |
| SYS-16 | **Playthrough sims** | Headless runs of the whole rules engine (no UI) with scripted players. See §10 | All §10 sims pass in `npm test` | M |
| SYS-17 | **Rules consistency** | Rules live as data (`game/src/rules/moves.ts`, `actions.ts`, `minions.ts`). Tests: every ATK has ≥ 1 DEF that stops it; every Need is produced by some move or the start state; every foothold has a DEF that removes it; every MIN has its closing DEF | These tests exist and pass | M |

---

## 8. Screens (UI)

| ID | Screen | Contents | Pri |
|---|---|---|---|
| UI-01 | Desktop gate | "Play on a computer" below 1024 px or touch-only | M |
| UI-02 | Menu | Title, scenario list (one), difficulty pick with a one-line description each | M |
| UI-03 | Briefing | The briefing files (CON-01), countdown (Easy: none; Medium 3 min; Hard 90 s real _(tune)_), "Start now" | M |
| UI-04 | SOC dashboard | Live log panel (filterable), alerts, 💀 and 🫀 meters, game clock, terminal, consoles (WAF, flags, accounts, sessions, deploy, backups, comms), Kiro panel, briefing files reachable | M |
| UI-05 | Death and minions on screen | Dot-matrix Death that reacts (lunges on a landed move, recoils on a closed one); minion figures appear with their waves; impact frames | M |
| UI-06 | Endings | Banished / Souls lost / Flatline / The return, each its own dot-matrix sequence | M |
| UI-07 | Report | SYS-11 facts and grades, Kiro's debrief (KIRO-06), download as Markdown | M |
| UI-08 | Sound | Ambience, heartbeat that speeds up as it weakens, impact hits, Death's voice stings | S |

Look and feel: GAME_PLAN §11 (code-driven dot-matrix; data stays crisp text).

---

## 9. Content and recording (CON, REC)

| ID | Item | Spec | Pri |
|---|---|---|---|
| REC-01 | Recording rig | `docker compose`: Juice Shop behind nginx (real access log), on an isolated Docker network with no route out; attack tools in their own container on that network | M |
| REC-02 | Capture | Per run: nginx access log, Juice Shop app log, a DB snapshot before and after, the uploads folder diff, timestamps. Stored as one JSON events file per move variant in `game/src/recordings/` | M |
| REC-03 | Variants | 2–3 per ATK move (IP, loud/quiet user agent, pacing); one script per variant, re-runnable | M |
| REC-04 | Seed data | Juice Shop's own users, plus extra fake customers if needed so souls feel like a business (count decided at first recording) | M |
| REC-05 | Minion recordings | One per MIN wave type, same rig | M |
| CON-01 | Briefing files | System map, admin list (who's legit), a normal-traffic baseline, the company playbook (PICERL steps) | M |
| CON-02 | Code for DEF-13 | The real vulnerable Juice Shop code per patchable hole, and the fix diff | M |
| CON-03 | Fallback texts | Rule-written hints, drafts and debrief templates for KIRO-09 | M |
| CON-04 | Death's taunts | ≥ 3 per move plus the special lines (§3.1) | M |
| CON-05 | Log explanations | One plain-words explanation per recorded log line type | S |
| CON-06 | Art stills | Death (≥ 5 poses), 4 minions, room props. List and owner decided by the team | M |

---

## 10. The playthrough sims (proof the game teaches the right thing)

Each runs headless with a fixed seed on Medium. These are tests, not hopes: if one fails, the rules are wrong.

| Sim | Scripted player | Must end with |
|---|---|---|
| SIM-1 | Does nothing | Souls all taken before the 10th real minute |
| SIM-2 | Only blocks every IP it sees | Loses souls anyway (Death switches IP each time); report flags whack-a-mole |
| SIM-3 | Pulls the plug at the first alert and leaves it | Flatline |
| SIM-4 | Contains well but never looks for footholds | "Banished", then **the return** through ATK-11 |
| SIM-5 | Follows the playbook: snapshot, contain the active route, find and remove footholds, patch, restore, bring things back | Banished; no return; report grade ≥ B in every phase |
| SIM-6 | Ignores minions, handles Death perfectly | Loses noticeable heartbeat and some souls to MIN-02; still can win |
| SIM-7 | Rotates the signing key but never patches token verification (when ATK-14 is in play) | The return through the forged token |

---

## 11. Lesson tracing

Every lesson a player should leave with, and the rows that teach it. A lesson with no row isn't taught; a row with no lesson is a gimmick.

| Lesson (real source) | Taught by |
|---|---|
| Blocking IPs alone is whack-a-mole (CISA AA20-245A) | DEF-06, REC-03, SIM-2, SYS-11 |
| Preserve evidence before changing things (NIST 800-61, CISA AA20-245A) | DEF-05, DEF-15, SYS-11 |
| Find every foothold before declaring victory | ATK-11–14, SYS-07, SIM-4 |
| Containment has a business cost (NIST 800-61r2 containment criteria) | SYS-06, DEF-09–11, SIM-3 |
| Don't tip the attacker off (CISA AA20-245A) | DEF-04, DEF-08, SYS-02 |
| Fix the hole, not the symptom | DEF-12 vs DEF-13, ATK-08 tamper variants |
| Stateless tokens survive password changes | ATK-07, ATK-14, DEF-09, SIM-7 |
| Restoring the wrong backup restores the attacker | DEF-17 |
| Tell noise from the real threat, but don't ignore it | MIN-01–04, SIM-6 |
| Escalate and notify on time (GDPR Art. 33) | DEF-19, DEF-20, SYS-14 |
| An assistant helps but is slow and needs checking | KIRO-01, KIRO-02, KIRO-08 |

---

## 12. Not doing (for scenario one)

3D · live attacks during play · multiplayer · accounts or saved progress · mobile · scenarios two and three (stretch) · Kiro upgrades (stretch, KIRO-11) · an LLM driving Death.

## 13. Still open (doesn't block building)

- **Name** (KI-01): the team decides.
- **Who does what**: the team decides once both are online.
- **Hosting for the page and SYS-12** (KI-04).
- **Category:** Frankenstein (horror game + security training), Costume Contest as the alternative.
