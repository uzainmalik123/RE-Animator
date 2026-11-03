import { parseArgs } from 'node:util';
import { UsageError } from '@poltergeist/core';

export type CliArgs =
  | { command: 'help' }
  | {
      command: 'summon';
      spec: string;
      config?: string;
      only?: string[];
      personas?: string[];
      reps?: number;
      recompile: boolean;
      seance: boolean;
    }
  | { command: 'init'; dir?: string; target?: string; spec?: string; hook: boolean; force: boolean }
  | { command: 'export'; runDir: string; out: string; maxMb?: number }
  | { command: 'replay'; dir: string; speed: number }
  | { command: 'power'; out: string };

export const HELP_TEXT = `poltergeist: haunt a Kiro spec with adversarial ghosts

Usage:
  poltergeist summon --spec <dir> [options]
  poltergeist init [--dir <project>] [init options]
  poltergeist export <runDir> --out <dir> [--max-mb <n>]
  poltergeist replay <dir> [--speed <n>]
  poltergeist power --out <dir>

Summon options:
  --spec <dir>        spec folder holding requirements.md (required)
  --config <path>     config file (default ./poltergeist.config.json)
  --only <ids>        only these criteria, comma-separated (e.g. 3.2,4.1)
  --personas <ids>    only these personas, comma-separated (wraith,banshee,doppelganger,lich,revenant)
  --reps <n>          repetitions per plan, 1-10 (default from config)
  --recompile         ignore cached plans and compile again
  --seance            stream run events on ws://127.0.0.1:6660/runs/<id>
  -h, --help          show this help

Init options (wire a project into Kiro's .kiro/):
  --dir <project>     project folder (default .)
  --target <origin>   the app's local origin (default http://localhost:3000)
  --spec <dir>        spec folder the agent hook names (default: whichever just ran)
  --no-hook           skip the agent hook
  --force             replace files that differ (otherwise they are kept)

Recordings (replay a finished run with no app, LLM or browser):
  export <runDir>     copy a run folder (.poltergeist/runs/<id>) into a static bundle
  --out <dir>         new or empty folder for the bundle
  --max-mb <n>        size cap, 1-1000 (default 50); frames are thinned to fit
  replay <dir>        stream a run folder or bundle on ws://127.0.0.1:6660/runs/<id>,
                      labelled RECORDED, once a client connects
  --speed <n>         playback speed, 1-16 (default 1)

Kiro Power (load the tools only when testing a spec):
  power --out <dir>   write a Kiro Power for this checkout into a new or empty folder;
                      install it in Kiro with "Import power from a folder"

Exit codes:
  0  nothing haunted (init: every file written or already up to date)
  1  at least one criterion haunted (init: some files differ and were kept)
  2  usage, configuration or system error
`;

const list = (flag: string, value: string | undefined): string[] | undefined => {
  if (value === undefined) return undefined;
  const ids = value.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) throw new UsageError(`${flag} needs at least one id`);
  return ids;
};

/** The flags each command accepts (`help` is everyone's). */
const OWNED = {
  summon: ['spec', 'config', 'only', 'personas', 'reps', 'recompile', 'seance'],
  init: ['dir', 'target', 'spec', 'no-hook', 'force'],
  export: ['out', 'max-mb'],
  replay: ['speed'],
  power: ['out'],
} as const;
type Command = keyof typeof OWNED;
const isCommand = (c: string): c is Command => Object.hasOwn(OWNED, c);

/** Parses `poltergeist` arguments (D-36). Throws `UsageError` for anything it can't accept. */
export function parseCliArgs(argv: readonly string[]): CliArgs {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        spec: { type: 'string' },
        config: { type: 'string' },
        only: { type: 'string' },
        personas: { type: 'string' },
        reps: { type: 'string' },
        recompile: { type: 'boolean', default: false },
        seance: { type: 'boolean', default: false },
        dir: { type: 'string' },
        target: { type: 'string' },
        'no-hook': { type: 'boolean', default: false },
        force: { type: 'boolean', default: false },
        out: { type: 'string' },
        'max-mb': { type: 'string' },
        speed: { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (err) {
    throw new UsageError(err instanceof Error ? err.message : String(err));
  }
  const { values, positionals } = parsed;
  const [command, ...rest] = positionals;
  if (values.help || command === undefined || command === 'help') return { command: 'help' };
  if (!isCommand(command)) throw new UsageError(`unknown command: ${command}`);
  const takesFolder = command === 'export' || command === 'replay';
  const [folder, ...extra] = takesFolder ? rest : [undefined, ...rest];
  if (extra.length) throw new UsageError(`unexpected argument: ${extra[0]}`);
  const owned: readonly string[] = OWNED[command];
  const foreign = (Object.keys(values) as (keyof typeof values)[]).find((flag) => {
    const v = values[flag];
    return flag !== 'help' && !owned.includes(flag) && v !== undefined && v !== false;
  });
  if (foreign) throw new UsageError(`--${foreign} is not a${/^[aeiou]/.test(command) ? 'n' : ''} ${command} option`);
  if (command === 'export') {
    if (folder === undefined) throw new UsageError('export needs a run folder: poltergeist export <runDir> --out <dir>');
    if (values.out === undefined) throw new UsageError('--out is required');
    let maxMb: number | undefined;
    if (values['max-mb'] !== undefined) {
      maxMb = /^\d+$/.test(values['max-mb']) ? Number(values['max-mb']) : NaN;
      if (!(maxMb >= 1 && maxMb <= 1000)) throw new UsageError(`--max-mb must be an integer 1–1000, got ${values['max-mb']}`);
    }
    return { command: 'export', runDir: folder, out: values.out, ...(maxMb !== undefined ? { maxMb } : {}) };
  }
  if (command === 'replay') {
    if (folder === undefined) throw new UsageError('replay needs a recording folder: poltergeist replay <dir>');
    let speed = 1;
    if (values.speed !== undefined) {
      speed = /^\d+(\.\d+)?$/.test(values.speed) ? Number(values.speed) : NaN;
      if (!(speed >= 1 && speed <= 16)) throw new UsageError(`--speed must be a number 1–16, got ${values.speed}`);
    }
    return { command: 'replay', dir: folder, speed };
  }
  if (command === 'power') {
    if (values.out === undefined) throw new UsageError('--out is required');
    return { command: 'power', out: values.out };
  }
  if (command === 'init') {
    return {
      command: 'init',
      ...(values.dir !== undefined ? { dir: values.dir } : {}),
      ...(values.target !== undefined ? { target: values.target } : {}),
      ...(values.spec !== undefined ? { spec: values.spec } : {}),
      hook: !values['no-hook'],
      force: values.force,
    };
  }
  if (values.spec === undefined) throw new UsageError('--spec is required');

  let reps: number | undefined;
  if (values.reps !== undefined) {
    reps = /^\d+$/.test(values.reps) ? Number(values.reps) : NaN;
    if (!Number.isInteger(reps) || reps < 1 || reps > 10) throw new UsageError(`--reps must be an integer 1–10, got ${values.reps}`);
  }
  const only = list('--only', values.only);
  const personas = list('--personas', values.personas);
  return {
    command: 'summon',
    spec: values.spec,
    ...(values.config !== undefined ? { config: values.config } : {}),
    ...(only ? { only } : {}),
    ...(personas ? { personas } : {}),
    ...(reps !== undefined ? { reps } : {}),
    recompile: values.recompile,
    seance: values.seance,
  };
}
