import { UsageError } from '@poltergeist/core';
import { describe, expect, it } from 'vitest';
import { HELP_TEXT, parseCliArgs } from '../src/args.js';

describe('parseCliArgs', () => {
  it.each([[[]], [['--help']], [['-h']], [['help']], [['summon', '--help']]])('%j is help', (argv) => {
    expect(parseCliArgs(argv)).toEqual({ command: 'help' });
  });

  it('parses every summon flag', () => {
    const argv = ['summon', '--spec', 's', '--only', '3.2, 4.1', '--personas', 'wraith,banshee', '--reps', '5', '--recompile', '--seance', '--config', 'c.json'];
    expect(parseCliArgs(argv)).toEqual({
      command: 'summon', spec: 's', config: 'c.json', only: ['3.2', '4.1'], personas: ['wraith', 'banshee'], reps: 5, recompile: true, seance: true,
    });
  });

  it('defaults the booleans and leaves the rest unset', () => {
    expect(parseCliArgs(['summon', '--spec', 's'])).toEqual({ command: 'summon', spec: 's', recompile: false, seance: false });
  });

  it.each([
    [['summon'], /--spec is required/],
    [['summon', '--spec', 's', '--reps', '0'], /--reps must be an integer 1–10/],
    [['summon', '--spec', 's', '--reps', 'x'], /--reps must be an integer 1–10/],
    [['summon', '--spec', 's', '--reps', '2.5'], /--reps must be an integer 1–10/],
    [['summon', '--spec', 's', '--bogus'], /--bogus/],
    [['summon', '--spec'], /--spec/],
    [['exorcise'], /unknown command: exorcise/],
    [['summon', '--spec', 's', '--only', ','], /--only needs at least one id/],
    [['summon', '--spec', 's', 'extra'], /unexpected argument: extra/],
  ])('%j is a usage error', (argv, message) => {
    expect(() => parseCliArgs(argv)).toThrow(UsageError);
    expect(() => parseCliArgs(argv)).toThrow(message);
  });

  it('documents every flag and the exit codes', () => {
    for (const flag of ['--spec', '--config', '--only', '--personas', '--reps', '--recompile', '--seance']) expect(HELP_TEXT).toContain(flag);
    for (const code of ['0', '1', '2']) expect(HELP_TEXT).toMatch(new RegExp(`\\b${code}\\b`));
  });
});

describe('parseCliArgs init (F13)', () => {
  it('defaults hook on and force off', () => {
    expect(parseCliArgs(['init'])).toEqual({ command: 'init', hook: true, force: false });
  });

  it('parses every init flag', () => {
    const argv = ['init', '--dir', 'a', '--target', 'http://localhost:5173', '--spec', 's', '--no-hook', '--force'];
    expect(parseCliArgs(argv)).toEqual({ command: 'init', dir: 'a', target: 'http://localhost:5173', spec: 's', hook: false, force: true });
  });

  it.each([
    [['init', '--reps', '2'], /--reps is not an init option/],
    [['init', '--seance'], /--seance is not an init option/],
    [['summon', '--spec', 'x', '--force'], /--force is not a summon option/],
    [['summon', '--spec', 'x', '--dir', 'd'], /--dir is not a summon option/],
    [['init', 'extra'], /unexpected argument: extra/],
  ])('%j is a usage error', (argv, message) => {
    expect(() => parseCliArgs(argv)).toThrow(UsageError);
    expect(() => parseCliArgs(argv)).toThrow(message);
  });

  it('documents init and its flags', () => {
    expect(HELP_TEXT).toContain('poltergeist init');
    for (const flag of ['--dir', '--target', '--no-hook', '--force']) expect(HELP_TEXT).toContain(flag);
  });

  it('parses export with a run folder, --out and --max-mb (F15)', () => {
    expect(parseCliArgs(['export', 'runs/r1', '--out', 'dist'])).toEqual({ command: 'export', runDir: 'runs/r1', out: 'dist' });
    expect(parseCliArgs(['export', 'runs/r1', '--out', 'dist', '--max-mb', '20'])).toEqual({ command: 'export', runDir: 'runs/r1', out: 'dist', maxMb: 20 });
  });

  it('parses replay with a folder and --speed (F15)', () => {
    expect(parseCliArgs(['replay', 'dist'])).toEqual({ command: 'replay', dir: 'dist', speed: 1 });
    expect(parseCliArgs(['replay', 'dist', '--speed', '4'])).toEqual({ command: 'replay', dir: 'dist', speed: 4 });
    expect(parseCliArgs(['replay', 'dist', '--speed', '2.5'])).toEqual({ command: 'replay', dir: 'dist', speed: 2.5 });
  });

  it.each([
    [['export', '--out', 'd'], /export needs a run folder/],
    [['export', 'r'], /--out is required/],
    [['export', 'r', 'r2', '--out', 'd'], /unexpected argument: r2/],
    [['export', 'r', '--out', 'd', '--max-mb', '0'], /--max-mb must be an integer 1–1000/],
    [['export', 'r', '--out', 'd', '--max-mb', '1001'], /--max-mb must be an integer 1–1000/],
    [['export', 'r', '--out', 'd', '--speed', '2'], /--speed is not an export option/],
    [['export', 'r', '--out', 'd', '--spec', 's'], /--spec is not an export option/],
    [['replay'], /replay needs a recording folder/],
    [['replay', 'd', '--speed', '0.5'], /--speed must be a number 1–16/],
    [['replay', 'd', '--speed', '17'], /--speed must be a number 1–16/],
    [['replay', 'd', '--speed', 'fast'], /--speed must be a number 1–16/],
    [['replay', 'd', '--out', 'x'], /--out is not a replay option/],
    [['summon', '--spec', 's', '--out', 'x'], /--out is not a summon option/],
    [['init', '--speed', '2'], /--speed is not an init option/],
  ])('%j is a usage error', (argv, msg) => {
    expect(() => parseCliArgs(argv)).toThrow(UsageError);
    expect(() => parseCliArgs(argv)).toThrow(msg);
  });

  it('documents export and replay', () => {
    expect(HELP_TEXT).toContain('poltergeist export <runDir> --out <dir>');
    expect(HELP_TEXT).toContain('poltergeist replay <dir>');
    for (const flag of ['--max-mb', '--speed']) expect(HELP_TEXT).toContain(flag);
  });
});

describe('parseCliArgs power (F18)', () => {
  it('parses --out', () => expect(parseCliArgs(['power', '--out', 'd'])).toEqual({ command: 'power', out: 'd' }));
  it('requires --out', () => expect(() => parseCliArgs(['power'])).toThrow(new UsageError('--out is required')));
  it('rejects other flags', () => expect(() => parseCliArgs(['power', '--out', 'd', '--force'])).toThrow(/not a power option/));
  it('rejects positionals', () => expect(() => parseCliArgs(['power', 'x', '--out', 'd'])).toThrow(UsageError));
  it('is in the help', () => expect(HELP_TEXT).toContain('poltergeist power --out <dir>'));
});

describe('parseCliArgs sandbox (F21)', () => {
  const base = ['sandbox', '--spec', 's'];
  it('defaults', () =>
    expect(parseCliArgs(base)).toEqual({ command: 'sandbox', spec: 's', host: '127.0.0.1', port: 6662, perClientHour: 6, runTimeoutSec: 300, keep: 5, trustProxy: false }));
  it('parses every flag', () =>
    expect(
      parseCliArgs([...base, '--config', 'c.json', '--reps', '2', '--host', '0.0.0.0', '--port', '8080', '--per-client-hour', '0', '--run-timeout', '60', '--keep', '9', '--trust-proxy']),
    ).toEqual({ command: 'sandbox', spec: 's', config: 'c.json', reps: 2, host: '0.0.0.0', port: 8080, perClientHour: 0, runTimeoutSec: 60, keep: 9, trustProxy: true }));
  it('requires --spec', () => expect(() => parseCliArgs(['sandbox'])).toThrow(new UsageError('--spec is required')));
  it.each([
    ['--port', '70000', '--port must be an integer 0–65535, got 70000'],
    ['--per-client-hour', '1001', '--per-client-hour must be an integer 0–1000, got 1001'],
    ['--run-timeout', '9', '--run-timeout must be an integer 10–3600, got 9'],
    ['--keep', '0', '--keep must be an integer 1–50, got 0'],
    ['--keep', '2.5', '--keep must be an integer 1–50, got 2.5'],
    ['--reps', '11', '--reps must be an integer 1–10, got 11'],
  ])('bounds %s %s', (flag, value, msg) => expect(() => parseCliArgs([...base, flag, value])).toThrow(new UsageError(msg)));
  it('rejects summon-only flags', () => expect(() => parseCliArgs([...base, '--seance'])).toThrow(/not a sandbox option/));
  it('is in the help', () => {
    expect(HELP_TEXT).toContain('poltergeist sandbox --spec <dir>');
    for (const flag of ['--host', '--port', '--per-client-hour', '--run-timeout', '--keep', '--trust-proxy']) expect(HELP_TEXT).toContain(flag);
  });
});
