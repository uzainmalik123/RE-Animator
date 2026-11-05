# Implementation Plan

Work one PRD feature at a time, through the grill → plan → implement → review cycle in `../../AGENTS.md`. Tick a box only when the feature's "Done when" in `docs/PRD.md` passes and `npm run health` is green. Build the vertical slice (0–5) on ONE repo before widening.

- [x] 0. R0 Scaffold (Vite + React + TS, canvas page, health gate, CI, backend entry)
  - _Requirements: none (infrastructure)_
- [x] 1. R1 Dot-matrix renderer (the art engine)
  - _Requirements: 4.1, 4.3, 4.4_
- [ ] 2. Choose + prepare the one demo repo (KI-R1), keep before/after in fixtures/
  - _Requirements: 1 (groundwork)_
- [ ] 3. R2 The Raise: revive the demo repo, real vitals, pulse scene
  - _Requirements: 1.1–1.4_
  - _Built on the practice corpse (D-R14); tick once the demo repo (task 2) runs through it._
- [ ] 4. R3 Death's attack: wire in Poltergeist, get findings
  - _Requirements: 2.1, 2.2, 2.3_
  - _Built (D-R16, D-R17); tick once `doppler run -- npm run attack:check` finds a real wound (KI-R15)._
- [ ] 5. R4 The attack scene: Death + minions + wounds over the app
  - _Requirements: 2.4, 4.2_
  - _Built (D-R19); tick once a key-backed run plays with a visible wound (KI-R15)._
- [ ] 6. R5 Wounds + heal loop (Kiro fix, re-run, close wound, PR text)
  - _Requirements: 3.1–3.4_
  - _Built (D-R20) without the PR text; tick once Kiro heals a real wound and the re-run closes it (KI-R19)._
- [ ] 7. R7 Grimoire (agent surface)
  - _Requirements: 5.2_
  - _Built (D-R21) against a fake kiro-cli; tick once a real Kiro heal is cast, sealed and dared closed from it (KI-R21)._
- [ ] 8. R11 hosted replay; then R9 (arbitrary URLs)
  - _Requirements: as per PRD_
- [ ] 9. 🔒 Built in Kiro (D-R18): R6 Graveyard (pick a repo)
  - _Requirements: 5.1, 5.3_
- [ ] 10. 🔒 Built in Kiro (D-R18): R8 Autopsy (why it died)
  - _Requirements: as per PRD_
- [ ] 11. 🔒 Built in Kiro (D-R18): R10 Sound & atmosphere
  - _Requirements: as per PRD_
