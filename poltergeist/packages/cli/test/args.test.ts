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
});
