# The game plan (working title: TBD)

> **Status:** 2026-11-09: the build spec is now **`docs/PRD.md`**; where this plan and the PRD differ, the PRD wins. Draft for the team, 2026-11-08. The ideas below come from one long design conversation. Things marked **✅ Decided** were agreed; things marked **💡 Proposal** are suggestions waiting for the team's yes or no. Nothing is built yet.

---

## 1. Why we changed course

Reanimator (raise a dead GitHub repo, then Death attacks it) is shelved. All of its code is kept on the **`failed`** branch so we can learn from it.

Why it failed:
- **No point.** Anyone can point Claude or Kiro at a dead repo and it comes back to life. Our product added nothing an agent can't do on its own.
- **Drift.** We kept building features before deciding what the product was for, and ended up with a pile of screens and no vision.

How we avoid repeating it:
- **Decide before building.** This document comes first, then the code.
- **One scenario, fully polished**, before we touch a second.
- **The "couldn't an agent just do this?" test.** A *game* passes it: nobody can prompt their way into the panic of a live breach.

---

## 2. The pitch

> **You arrive expecting a horror game. You leave knowing how to respond to a real cyber emergency.**

A horror-themed **incident-response simulator**. You're the lone defender of a company's web app. **Death** breaks in and keeps attacking. You work from a dark, ASCII-styled security operations dashboard (the "SOC" view a real security team watches): reading live logs, making real defensive moves, under real pressure. **Kiro** is your assistant: it helps, but it doesn't play for you.

What makes it special:
- **Real attacks.** Every attack in the game was **actually run** against a deliberately vulnerable app in an isolated sandbox, then recorded. The logs you read are real logs.
- **Real lessons.** Every action you can take exists in real incident response and costs what it costs in real life.
- **Free play, not multiple choice.** You decide what to do, and Death reacts to it.

---

## 3. A playthrough, step by step

### 3.1 The menu
A black screen, the title, and a list of **scenarios** (one for now). You pick a scenario and a **difficulty** (Easy / Medium / Hard, see §8).

### 3.2 The briefing (on a timer) ✅ Decided
Before Death arrives, you're handed the files a real defender would have:
- what the system is and what runs where (the app, the database, the file storage)
- who has admin access
- what "normal" traffic looks like
- the company's response playbook

A **timer** counts down. Read what you can. You can reopen the files later, but then you're reading them with Death inside. That's how a real shift starts: the preparation is part of the job.

### 3.3 Death strikes
The briefing ends, the room goes cold, and the **live data starts flowing**: logs scroll, alerts fire, the meters start moving. From here on **the data is live and keeps changing**. That's where the intensity comes from.

### 3.4 You fight back
You investigate, contain, eradicate and recover, using the toolkit in §4. **Death adapts to every move you make** (§5). **Kiro** helps along the way (§6).

### 3.5 The ending
You either **banish Death** (win) or lose your **souls** or your **heartbeat** (§7).

### 3.6 The post-incident report
After the incident, a report of the kind real teams write: what happened, when you noticed each stage, what you did right, which classic mistakes you made, and what a real responder would have done instead. **The grading is done by fixed rules; the AI only writes it up in plain words**, so it can't invent things that didn't happen.

---

## 4. The player's toolkit (real actions, real costs) 💡 Proposal

You act through a **terminal** (typed commands, like real work) and **quick buttons** for common moves. Every action exists in real incident response, and each has its real-world **cost**. Those trade-offs are the gameplay.

The phases follow the **SANS "PICERL"** model most security teams use: **P**reparation, **I**dentification, **C**ontainment, **E**radication, **R**ecovery, **L**essons learned.

| Phase | Action | What it does | The catch (real cost) |
|---|---|---|---|
| **Investigate** | Search the logs | Filter by IP, user, page, status code | Takes time, and Death keeps moving |
| | Inspect accounts | Spot new admins and changed roles | Takes time |
| | Inspect uploaded files | Find planted files | Takes time |
| | Look up an IP | Check who the attacker is | Looking him up *actively* (pinging his server) **tips him off** |
| **Contain** | Block an IP | Cuts off that address | He just **switches IPs** (whack-a-mole), and you lose sight of him |
| | Rate-limit the login | Slows password guessing | Annoys real customers (small **heartbeat** cost) |
| | Lock an account | Stops a hijacked account | Locks out the real person and tips Death off |
| | End all sessions + force password reset | Kicks out stolen logins | Logs out **every** customer (**heartbeat** cost). Doing it too early, before you know how far he got, is a classic mistake |
| | Disable a feature | Turns off the vulnerable page (e.g. search, uploads) | Part of the site stops working (**heartbeat** cost) |
| | **Pull the plug** | Takes the whole site offline | Stops Death, but the **heartbeat drains fast** |
| **Eradicate** | Quick firewall rule (virtual patch) | Blocks the attack pattern | Fast but leaky; the real hole is still there |
| | Real code patch | Fixes the actual hole | Slow; deploying under pressure is risky |
| | Delete a backdoor / rogue admin | Removes his foothold | Miss **one** and he walks back in |
| | Rotate secrets | Changes keys and passwords | Logs everyone out; some things need reconfiguring |
| **Recover** | Restore from backup | Undoes his damage | Restore an **infected** backup and you restore his backdoor |
| | Bring the site back | Ends downtime | Too soon and he walks back in |
| **Preserve** | Snapshot the evidence | Saves logs and state before you change things | Takes time. Skip it and the report marks you down (the #1 real mistake) |
| **Communicate** | Escalate | Tells your boss or the incident lead | Takes time |
| | Notify legal / customers | Meets legal deadlines | A **"notify within X"** clock starts once you confirm a breach; miss it and the report marks you down |

---

## 5. Death: how he attacks and how he decides ✅ Decided (approach) / 💡 Proposal (details)

### 5.1 He runs on rules, not an LLM ✅
Death is driven by an **"AI Director"**, the same idea *Left 4 Dead* uses to pace its zombies. Deterministic, cheap, and it never surprises us during a demo.

Why not let an LLM drive Death: it could pick moves we never recorded, play differently every time, cost money per game, and refuse "attack" requests. The LLM gets safe jobs instead: **Death's taunts** (flavour only), **Kiro's hints**, and **writing up the report**.

### 5.2 How a decision works
1. **Death follows a real attack chain:** scout → break in → become admin → steal data → dig in → strike.
2. **Each stage has several recorded moves**, each tagged with **what it needs** (e.g. "his IP isn't blocked") and **what it gains him** (e.g. "an admin account").
3. **Every few seconds he looks at the board** (what you've blocked, patched, locked or taken offline) and **picks a move whose needs still hold**.
4. **A pacing layer** watches how overloaded you are. It speeds Death up when you're cruising, gives you a breather when you're drowning, and hands small noise attacks to Kiro.

### 5.3 How he adapts (real attacker behaviour)

| You do this | Death does this | The real lesson |
|---|---|---|
| Block his IP | Comes back from a new IP | IP blocking alone is whack-a-mole |
| Rate-limit the login | Switches to SQL injection | Fix the hole, not just the symptom |
| Lock the admin account he stole | Uses the backdoor admin he planted earlier, or falls back a stage | Look for persistence before you celebrate |
| Look him up actively | Notices, and **speeds up**: grabs data and strikes | Don't tip the attacker off |
| Close every route **and** remove every foothold | Has no moves left: **banished** | That's how incidents actually end |

### 5.4 Scenario one: the attack chain 💡 Proposal
Built on **OWASP Juice Shop**, a deliberately vulnerable web shop made for security training, running in Docker on our own machine. Every move is a **real attack with real tools**, recorded once.

| # | Stage | Death's recorded moves (variants) | What you'd see in the logs | Real technique (MITRE ATT&CK) |
|---|---|---|---|---|
| 1 | **Scouting** | Directory scan with a scanning tool (ffuf) | Hundreds of `404`s from one IP per minute; ffuf even signs its name ("Fuzz Faster U Fool") in the user agent | Wordlist scanning, T1595.003 |
| 2 | **Breaking in** | (a) SQL injection on the login form, or (b) guessing the admin's weak password (Hydra) | (a) a single successful login (the injected text isn't in normal logs, so a sharp player checks *who* logged in); (b) a burst of `401` failed logins, then one `200` success | Exploit public-facing app T1190 / brute force T1110 |
| 3 | **Becoming admin** | Registers his own admin account | `POST /api/Users` creating a user, followed by admin-only requests from the same IP | Create account T1136 / valid accounts T1078 |
| 4 | **Harvesting souls** | Dumps customer data through the search box (sqlmap) | Hundreds of near-identical search requests, huge responses; sqlmap names itself in the user agent unless he hides it | Exploit public-facing app T1190, exfiltration T1041 |
| 5 | **Digging in** | A second hidden admin, plus a planted file via upload | A new user you didn't create; an odd file appears in uploads | Create account T1136, account manipulation T1098 |
| 6 | **Striking** | Ransom note dropped, products defaced | Product descriptions suddenly changed by an admin account | Defacement T1491.002 |

Each stage gets **2–3 recorded variants** so Death has somewhere to go when you block his first route.

Honest note: real Juice Shop can't give him a full server takeover through an upload, so stage 5 stays at "hidden admin + planted file". We keep it true to the app.

---

## 6. Kiro, your familiar ✅ Decided (role)

Kiro **helps, but doesn't play for you**:
- **Hints** when you're stuck (how much depends on difficulty).
- **Drafts small scripts**: a log search, a firewall rule. **You approve them**; you stay in charge.
- **Fends off small attacks**: swats random scanner noise so you can focus on Death and don't feel overwhelmed.

---

## 7. Winning and losing 💡 Proposal

Two meters that **pull against each other**:

| Meter | What it is | How it drops | If it hits zero |
|---|---|---|---|
| **💀 Souls** | Your customers' data | Each record Death steals is a soul harvested | **You lose:** Death took them all |
| **🫀 Heartbeat** | The business staying alive | Downtime and locked-out customers **that you cause** | **You lose:** you killed the business yourself |

That puts the core real-world dilemma on screen: **pulling the plug saves souls but stops the heartbeat.** Overreact and you ruin the business yourself. Underreact and Death feeds.

**You win by banishing Death:** close **every** way in **and** remove **every** foothold he planted. He runs out of moves and is banished.

**The twist:** if you missed a backdoor, **Death comes back** during what you thought was your victory lap. That's the real-world mistake of "fixing the symptom, not the cause".

---

## 8. Difficulty levels ✅ Decided (levels) / 💡 Proposal (dials)

Players may never have seen a server log, so there are **three levels**. The rule that keeps this cheap: **one scenario, one set of recordings, and difficulty only turns dials.**

| Dial | **Easy** (never seen a log) | **Medium** | **Hard** |
|---|---|---|---|
| **Kiro** | Explains every alert in plain words, suggests your next move | Hints only when you've been stuck a while | Silent unless asked; asking costs time |
| **Controls** | Buttons for everything; terminal optional | Buttons + terminal | Terminal only |
| **Logs** | Suspicious lines highlighted; hover any line for "what this means" | Highlighted, no explanations | Raw, the way real analysts see them |
| **Briefing** | Untimed, with a "what to look for" checklist | Timed | Short timer |
| **Death** | Slower, telegraphs his next move | Normal pace, adapts | Faster, always plants a backdoor |
| **Meters** | More souls and heartbeat to spare | Normal | Very little room for error |

**Identical at every level:** the real attacks, the real consequences, and the report's verdict. Easy helps you *see*; it doesn't change the truth.

---

## 9. Realism vs fun ✅ Decided

**Fun wins, but the lessons stay real.** The presentation can be fiction; the lessons can't.

| Can bend for fun | Must stay real |
|---|---|
| Time compression (hours become minutes) | The actions and what they actually do |
| Death as a taunting character | How attackers really adapt |
| The horror atmosphere and pacing | What the logs look like (recorded from real attacks) |
| Dramatic moments | The trade-offs, e.g. going offline stops Death *and* hurts the business |
| | The report's verdict |

**The test for every feature:** *if a player did this in a real incident, would it help or hurt the same way it does in the game?* If not, we fix the mechanic, not the lesson.

---

## 10. How the attacks are made ✅ Decided

Two moments, never mixed:

1. **Recording (once, by us, while building).** Death's attacks are **scripts** using real tools (sqlmap, ffuf, Hydra, curl), run against Juice Shop in Docker **on our own machine, isolated**. Kiro can write and run them ("Kiro played Death" is a nice Kiroween story). What matters is that each attack ends up as a **script we can re-run**, and we capture everything a real security team would see: web server logs, alerts, traffic.
2. **Playing (every time).** The player **never triggers a real attack**. The game replays the real recordings, and the Director picks which recorded move plays next based on what the player did. So it's **safe**, the **data is real**, and it **can't break during a demo**.

---

## 11. The look ✅ Decided (direction)

**ASCII / dot-matrix horror. No 3D.**

### 11.1 The trouble we had: animation that wasn't real-time
Our first approach to the art was **pre-rendered**: generate a video of each action (with Seedance, a paid AI video tool), cut it into frames, then have Claude turn the frames into ASCII and smooth the transitions. It looked good, but it had three problems for a game:
- **It was baked.** A frame sequence plays the same way every time. It **can't react** to what the player does, and in this game everything reacts.
- **Every new move meant a new video.** Changing an animation meant regenerating, re-cutting and re-converting.
- **It cost money.** Seedance is a paid tool, and we don't have it.

### 11.2 The fix: code runs the animation ✅
Our teammate's "Hands and Grimoire" piece already shows the answer. **Nothing in it is pre-rendered:**
1. **A handful of still cut-out images** (a hand, a book, a palm, fire, pages). Seven stills plus two sounds make up the whole piece.
2. **Code moves them** every frame: rotating the hand around its wrist, opening the book, raising flames that sway and fade, bobbing the Kiro ghost, scattering particles and glow.
3. **Every frame is turned into dots live**, in the browser at 60fps:
   - brightness decides **how big a dot is** (four levels),
   - a fixed **dither pattern** turns in-between brightness into texture instead of banding,
   - the **colour underneath tints the dot** (skin stays skin, old paper stays paper, magic light stays purple), and dim warm colours fade to grey so the dark stays dark,
   - a slight **flicker** keeps it alive, like candlelight.
4. **Impact frames** are code too: on a hit, an inverted flash, then a white fade and a small screen shake.

### 11.3 Why that matters for us
- **It's changeable on the go.** Animation is code, so it can **react to the game in real time**: Death's hand lunges when an attack lands, the screen shakes when souls are taken, the heartbeat pulses faster as it weakens, panels glitch when he breaks in. Pre-rendered frames could never do that.
- **Tweaks are cheap.** Change a number (speed, angle, glow, timing) and reload. No regenerating video.
- **It's free.** The stills can be free photos, stock cut-outs or images from free generators. No video tool needed.
- **Death and his minions** are built the same way: a few stills each, moved by code, dot-ified live.
- **We have a head start.** The old Reanimator had its own dot-matrix renderer (`reanimator/src/render/` on the `failed` branch) that we can study.

### 11.4 Data on screen
- **Live data stays crisp and readable.** Logs, alerts and the terminal are real text in the same mono font and palette; **dot-ifying text would make it unreadable**. Charts can go through the dot filter.
- **The dot world bleeds into the screens**: Death's hand reaching over a panel, a panel glitching when an attack lands. So the room and the data feel like one place, not screens pasted on a background.

---

## 12. Scope 💡 Proposal

**Must have (scenario one, polished):**
- Menu → briefing → live attack → ending → report
- The toolkit (§4) and Death's Director (§5) with the six-stage chain and 2–3 variants per stage
- Souls + heartbeat, banishment, the "he comes back" twist
- The three difficulty levels as dials
- Kiro: hints, drafted scripts, swatting noise
- The look (§11)

**Only if there's time:**
- Scenarios two and three
- Death's minions as visible characters
- Sound design

**Not doing:**
- 3D
- Live attacks while playing
- Multiplayer

---

## 13. Open questions for the team

1. **Name.** "RE:Animator" no longer fits. Ideas welcome.
2. **Deadline and hours.** When is the Kiroween submission due, and how many hours a day can we each put in? This decides how much of §12 is realistic.
3. **Kiro in the game.** Is it powered by a live LLM during play (needs a key, or a free model) or by pre-written hints? Should the character be called Kiro?
4. **Minions.** Are Death's minions visible characters, the small noise attacks Kiro swats, or both?
5. **Hackathon category.** Still **Frankenstein** (a mash-up of horror game + security training), or **Costume Contest** for the look?
6. **What survives from the old repo.** The dot-matrix renderer and parts of the backend may be reusable. We'll decide once the design is settled, then clean up `main` in one PR.

---

## Sources (from the research)

- NIST SP 800-61 Rev. 3, Incident Response (2025): https://csrc.nist.gov/pubs/sp/800/61/r3/final
- NIST SP 800-61 Rev. 2 (containment strategy criteria): https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-61r2.pdf
- SANS Incident Handler's Handbook (PICERL): https://www.sans.org/white-papers/33901/
- CISA AA20-245A, common incident-response mistakes: https://www.cisa.gov/news-events/cybersecurity-advisories/aa20-245a
- MITRE ATT&CK: https://attack.mitre.org/
- OWASP Juice Shop: https://owasp.org/www-project-juice-shop/ and its guide https://pwning.owasp-juice.shop/
- M-Trends 2025 (dwell time): https://cloud.google.com/blog/topics/threat-intelligence/m-trends-2025/
- IBM Cost of a Data Breach 2025: https://www.ibm.com/think/x-force/2025-cost-of-a-data-breach-navigating-ai
- Prior art: Backdoors & Breaches (https://www.blackhillsinfosec.com/tools/backdoorsandbreaches/classic/), TryHackMe SOC Simulator, CyberCIEGE, CISA Tabletop Exercise Packages
