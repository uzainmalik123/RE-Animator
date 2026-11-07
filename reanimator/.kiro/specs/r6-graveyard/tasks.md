# Implementation Plan: R6, the graveyard

The detailed, test-first steps are in `docs/plans/2026-11-07-R6-graveyard.md`. Tick a box when the task's tests pass and `npm run health` is green.

- [x] 1. Two more prepared graves (`sundial-2015`, `tally-2014`) that really die and rise
  - _Requirements: 6.3_
- [x] 2. Shared headstone type + backend graveyard (`listGraves`, `graveDir`)
  - _Requirements: 5.1, 5.5_
- [x] 3. API: `GET /api/graveyard`, `POST /api/rituals {grave}`, wired in `main.ts`
  - _Requirements: 5.1–5.4_
- [x] 4. Client: `requestRitual` targets, `fetchGraveyard`, `useGraveyard`, `useRitual` start/reset
  - _Requirements: 1.4, 1.5, 4.2_
- [x] 5. The scene maths (`src/graveyard/scene.ts`)
  - _Requirements: 2.1, 2.3, 2.4_
- [x] 6. The `Graveyard` view and CSS
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 6.1, 6.2_
- [x] 7. `RaiseScene` / `RaiseView` / `App`: pick → walk → raise, and back
  - _Requirements: 1.3, 2.1–2.3, 3.3, 4.1–4.3_
- [x] 8. Docs, decisions, known issues, screenshot, `npm run health`
  - _Requirements: 6.4_
