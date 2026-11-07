import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkEnvText, checkFiles } from './check-env-files.mjs';

test('an empty template is clean, placeholders and non-secret examples too', () => {
  const text = ['# comment', 'ANTHROPIC_API_KEY=', 'GEMINI_API_KEY=""', 'GROQ_API_KEY=<your key>', '# AWS_REGION=us-east-1', 'REANIMATOR_LLM=gemini', 'GEMINI_MODEL=gemini-x', 'VITE_REPLAY=1'].join('\n');
  assert.deepEqual(checkEnvText(text), []);
});

test('a secret-named variable with a value fails, commented out or quoted too, and the value is never printed', () => {
  const problems = checkEnvText(['GEMINI_API_KEY=hunter2', '# GROQ_API_KEY=abc123', "export E2B_API_KEY='zzz'", 'CANDY_SWAP_PASSWORD=pw # demo'].join('\n'));
  assert.equal(problems.length, 4);
  assert.match(problems[0], /line 1: GEMINI_API_KEY has a value/);
  assert.match(problems[1], /line 2: GROQ_API_KEY/);
  assert.match(problems[2], /line 3: E2B_API_KEY/);
  assert.match(problems[3], /line 4: CANDY_SWAP_PASSWORD/);
  assert.ok(problems.every((p) => !/hunter2|abc123|zzz|pw/.test(p.replace(/PASSWORD/, ''))));
});

test('a token-shaped string fails even under an innocent name or in a comment', () => {
  const cases = [
    'NOTE=sk-ant-api03-abcdefghijklmnop',
    '# paste: AIzaSyA1234567890abcdefghijklmnopqrstu',
    'X=gsk_abcdefghijklmnopqrstuvwx',
    'X=AKIAABCDEFGHIJKLMNOP',
    'X=e2b_0123456789abcdef0123456789',
    'X=ghp_abcdefghijklmnopqrstuvwxyz0123456789',
  ];
  for (const c of cases) assert.notEqual(checkEnvText(c).length, 0, c);
});

test('a committed real .env fails; templates and the replay flags are checked, other files ignored', () => {
  const files = { 'reanimator/.env': 'X=1', 'a/.env.local': 'X=1', 'poltergeist/.env.example': 'ANTHROPIC_API_KEY=k', 'reanimator/.env.replay': 'VITE_REPLAY=1', 'src/env.ts': 'API_KEY=x' };
  const problems = checkFiles(Object.keys(files), (p) => files[p]);
  assert.equal(problems.length, 3);
  assert.match(problems[0], /^reanimator\/\.env: a real env file is committed/);
  assert.match(problems[1], /^a\/\.env\.local: a real env file/);
  assert.match(problems[2], /^poltergeist\/\.env\.example line 1: ANTHROPIC_API_KEY has a value/);
});
