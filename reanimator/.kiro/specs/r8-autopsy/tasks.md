# Tasks: R8, the autopsy

Built in Kiro (D-R18). Plan: `docs/plans/2026-11-07-R8-autopsy.md`.

- [x] 1. Shared types, reducer, guard and Markdown (`shared/autopsy.ts`, `shared/ritual.ts`)
  - _Requirements: 1.2, 1.3, 3.5, 4.1_
- [x] 2. The line diff (`server/diff.ts`)
  - _Requirements: 1.3, 1.4_
- [x] 3. The autopsy builder and its classifier table (`server/autopsy.ts`)
  - _Requirements: 1.1–1.6, 2.1–2.4_
- [x] 4. Emit it from the ritual, never blocking the raise (`server/ritual.ts`)
  - _Requirements: 1.1, 1.5, 4.2, 4.3_
- [x] 5. The slab scene maths (`src/autopsy/scene.ts`)
  - _Requirements: 3.4, 3.6_
- [x] 6. The `Autopsy` section and its styles, wired into `RaiseView`
  - _Requirements: 3.1–3.5_
- [x] 7. Replay carries it (test in `src/replay/`)
  - _Requirements: 3.2, 4.1, 4.2_
- [x] 8. Integration test on the three prepared graves
  - _Requirements: 5.2_
- [x] 9. Docs, decisions, known issues, screenshot, `npm run health`
  - _Requirements: 5.1–5.3_
