import { configDefaults, defineConfig } from 'vitest/config';

/**
 * Tests whose assertions need a real race on the claims fixture (a barrier gap < 50 ms, 3.2 `haunted`). On CI they
 * flaked while other browser test files ran beside them (KI-58), so `npm test` runs them last, one file at a time.
 */
export const RACE_TESTS = [
  'packages/core/test/runner/actor.test.ts',
  'packages/core/test/runner/run.test.ts',
  'packages/core/test/runner/done-when.test.ts',
  'packages/core/test/report/done-when.test.ts',
  'packages/core/test/summon/summon.test.ts',
  'packages/cli/test/done-when.test.ts',
  'packages/cli/test/recording-done-when.test.ts',
  'packages/cli/test/sandbox-done-when.test.ts',
  'packages/mcp/test/done-when.test.ts',
];

/** `POLTERGEIST_TESTS=rest` runs everything else in parallel, `race` runs `RACE_TESTS` serially; unset runs all. */
const pass = process.env.POLTERGEIST_TESTS;

export default defineConfig({
  test: {
    include: pass === 'race' ? RACE_TESTS : ['packages/*/test/**/*.test.ts', 'scripts/**/*.test.ts'],
    exclude: pass === 'rest' ? [...configDefaults.exclude, ...RACE_TESTS] : configDefaults.exclude,
    fileParallelism: pass !== 'race',
  },
});
