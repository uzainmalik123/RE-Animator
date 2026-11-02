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
