# Requirements Document: R6, the graveyard

## Introduction

The opening scene (PRD R6, D-R18). Today the app opens on a single "Begin the ritual" button that always raises the same practice corpse. R6 replaces it with a graveyard: a row of headstones, one per prepared dead repo, and Kiro (the familiar) walking out to fetch the one the necromancer chooses. The pick leads straight into the raise (R2). Nothing here fakes a result (D-R11): the headstones are the real fixtures on disk, and the walk is only a transition, never a claim about the ritual.

The grill (answered with the recommended option each time) settled these choices:

- **Where the list comes from:** the prepared fixtures themselves (`fixtures/*/manifest.json`), discovered by the backend. No second hand-kept list that could drift from the disk. Strangers' repos stay a separate path: the existing "Name a grave" field (R9), moved into the graveyard as "Dig a new grave".
- **How many graves:** three prepared graves, each dying at a different vital (install, build, serve), each with a chart so Death can attack it: `guestbook-2016` (the practice corpse), `sundial-2015`, `tally-2014`. All are ours, MIT, written inside the window (D-R14).
- **What a headstone says:** the repo's name, "died YYYY", its licence, and whether Death has a chart for it. Not the cause of death: that is R8 (autopsy).
- **The walk:** Kiro walks from the left edge to the chosen stone in about a second. The ritual starts at once, in parallel; the walk delays nothing real and is skipped under `prefers-reduced-motion`.
- **Coming back:** once a ritual is not running, "Back to the graveyard" returns to the stones, so another grave can be chosen.
- **The replay (R11):** unchanged. A recording starts at the ritual's first event, so it never shows the graveyard.

## Requirements

### Requirement 1: Choosing a grave

**User Story:** As the necromancer, I want to choose which dead project to raise, so that I decide what comes back to life.

#### Acceptance Criteria

1. WHEN the app opens, THE Graveyard SHALL show one headstone for every prepared grave the backend lists, in order of the year they died, then by name.
2. THE Headstone SHALL show the repo's name, the year it died, its licence, and whether Death has a chart to attack it with, all as real text.
3. WHEN the necromancer chooses a headstone, THE Graveyard SHALL start a ritual for that grave, and THE ritual SHALL raise that repo and no other.
4. IF the backend refuses the ritual (busy, unknown grave, not answering); a busy backend never swaps the chosen grave for the ritual already running, THEN THE Graveyard SHALL stay open, show the reason, and not play the walk.
5. WHILE the graveyard list is loading or the backend is not answering, THE Graveyard SHALL say so in text instead of showing an empty field.

### Requirement 2: Kiro fetches the body

**User Story:** As the necromancer, I want to see my familiar fetch the body, so that the pick feels like part of the story.

#### Acceptance Criteria

1. WHEN a ritual for a headstone has been accepted, THE Graveyard SHALL show Kiro walking to that headstone, then hand over to the raise scene.
2. THE walk SHALL NOT delay the ritual and SHALL NOT report any result: the ritual's vitals are the only thing that beat (D-R11).
3. WHERE `prefers-reduced-motion` is set, THE Graveyard SHALL hand over to the raise scene at once, with no walk, and its canvases SHALL draw one still frame.
4. THE Graveyard SHALL draw Kiro in `--magic` and the stones and fog in `--bone`, never mixing inks on one canvas (THEME §4).

### Requirement 3: Digging a new grave

**User Story:** As a developer, I want to name any public GitHub repo from the graveyard, so that the R9 path is still one click away.

#### Acceptance Criteria

1. THE Graveyard SHALL offer the "Name a grave" GitHub URL field and a button that raises it (R9), exactly as it worked before.
2. WHEN the field is empty, THE button SHALL be disabled; the graveyard no longer raises the practice corpse on an empty field.
3. WHEN a URL grave is accepted, THE app SHALL go straight to the raise scene, with no walk (it has no headstone).

### Requirement 4: Leaving the raise

**User Story:** As the necromancer, I want to go back to the graveyard, so that I can raise something else.

#### Acceptance Criteria

1. WHILE a ritual is examining or raising, or Death is attacking, or Kiro is casting, THE "Back to the graveyard" button SHALL be disabled.
2. WHEN the necromancer chooses "Back to the graveyard" after a ritual has risen or failed, THE app SHALL close that ritual's stream and attack and spell views, and show the graveyard again.
3. THE backend SHALL keep the old revived app until the next ritual starts, as before.

### Requirement 5: The graveyard on the backend

**User Story:** As a client, I want a list of graves and a way to raise one by id, so that the UI never builds filesystem paths.

#### Acceptance Criteria

1. THE Backend SHALL answer `GET /api/graveyard` with `{ graves: Headstone[] }`, one per directory of `fixtures/` whose manifest loads, ordered by `diedIn` then `name`, behind the same loopback guard as every other `/api` route.
2. WHEN `POST /api/rituals` carries `{ grave: <id> }`, THE Backend SHALL raise the listed fixture with that directory name; an id that is not listed SHALL be refused with 404 and `{ error: 'no such grave' }`, and an id that is not a plain directory name SHALL never reach the filesystem.
3. IF a body names both `repo` and `grave`, or `grave` is not a string, THEN THE Backend SHALL refuse it with 400.
4. WHEN `POST /api/rituals` carries neither, THE Backend SHALL raise the practice corpse as before.
5. THE Backend SHALL skip, not crash on, a fixture directory whose manifest does not load.

### Requirement 6: Honest, accessible, complete

**User Story:** As any viewer, I want the graveyard to be real and readable, so that I can trust it and use it.

#### Acceptance Criteria

1. THE Graveyard's headstones SHALL be real buttons in a list, reachable and usable with the keyboard alone, each with an accessible name that reads the repo, its death year and whether Death can attack it.
2. THE Graveyard's canvases SHALL each carry an `aria-label`.
3. THE three prepared graves SHALL each really die at their stated vital on Node 22 and really rise after their remedy, proved by an integration test that runs the real ritual on each (D-R11).
4. THE docs SHALL say the graveyard is built (PRD, tasks, DECISIONS D-R24), and `npm run health` SHALL be green.
