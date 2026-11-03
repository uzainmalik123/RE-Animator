import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Step } from '../../src/compiler/dsl.js';
import { parseConfig, type LoadedConfig } from '../../src/config/load.js';
import { generate } from '../../src/personas/index.js';
import { runActor } from '../../src/runner/actor.js';
import { BarrierSet } from '../../src/runner/barrier.js';
import { focusWalk, probeReachable } from '../../src/runner/focus.js';
import { installHolds } from '../../src/runner/holds.js';
import type { StepResult } from '../../src/runner/types.js';
import { guardLaunchOptions, newGuardedContext } from '../../src/safety/guard.js';

const ORIGIN = 'http://127.0.0.1:9';

const PAGE = `<!doctype html><html><body>
<a href="#x">Docs <span>guide</span></a>
<label for="n">Name</label><input id="n">
<button>Save</button><span role="button">Pay</span>
<button disabled>Locked</button><button style="display:none">Hidden</button><p id="out"></p>
<script>document.querySelector('button').onclick = () => { document.getElementById('out').textContent = 'Saved ' + document.getElementById('n').value; };</script>
</body></html>`;

let browser: Browser;
let loaded: LoadedConfig;
const contexts: BrowserContext[] = [];

beforeAll(async () => {
  browser = await chromium.launch(guardLaunchOptions());
  loaded = parseConfig({ target: ORIGIN, routes: [{ path: '/', auth: false }] }, { configPath: join(tmpdir(), 'poltergeist.config.json'), env: {} });
});
afterAll(async () => {
  await browser?.close();
});
afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close().catch(() => undefined)));
});

async function open(html = PAGE): Promise<{ page: Page; context: BrowserContext }> {
  const context = await newGuardedContext(browser, { allowedHosts: loaded.allowedHosts });
  contexts.push(context);
  const page = await context.newPage();
  await page.setContent(html);
  return { page, context };
}

const button = (name: string) => ({ role: 'button', name });

describe('focusWalk (F20, D-48)', () => {
  it('tabs to a button and counts the Tabs', async () => {
    const { page } = await open();
    expect(await focusWalk(page, button('Save'))).toMatchObject({ reached: true, tabs: 3, xy: { x: expect.any(Number), y: expect.any(Number) } });
  });

  it('reaches a text target inside a focusable link', async () => {
    const { page } = await open();
    expect(await focusWalk(page, { text: 'guide' })).toMatchObject({ reached: true, tabs: 1 });
  });

  it('a target that already has focus takes no Tabs', async () => {
    const { page } = await open();
    await page.focus('#n');
    expect(await focusWalk(page, { label: 'Name' })).toMatchObject({ reached: true, tabs: 0 });
  });

  it('stops after one round of the page when the target never gets focus', async () => {
    const { page } = await open();
    expect(await focusWalk(page, button('Pay'))).toEqual({ reached: false, why: 'cycle' });
  });

  it('stops quickly on a page with nothing focusable', async () => {
    const { page } = await open('<p>nothing</p>');
    const t = performance.now();
    expect(await focusWalk(page, { text: 'nothing' })).toEqual({ reached: false, why: 'cycle' });
    expect(performance.now() - t).toBeLessThan(1000);
  });
});

describe('focusWalk review fixes (F20)', () => {
  it('passes through an iframe instead of calling it a full round', async () => {
    const { page } = await open('<button>A</button><iframe srcdoc="<button>1</button><button>2</button><button>3</button>"></iframe><button>Save</button>');
    await page.frameLocator('iframe').getByRole('button', { name: '3' }).waitFor();
    expect(await focusWalk(page, button('Save'))).toMatchObject({ reached: true });
  });

  it('passes through a closed shadow root', async () => {
    const { page } = await open(`<button>A</button><x-box></x-box><button>Save</button>
<script>customElements.define('x-box', class extends HTMLElement { constructor() { super(); this.attachShadow({ mode: 'closed' }).innerHTML = '<input><input><input>'; } });</script>`);
    expect(await focusWalk(page, button('Save'))).toMatchObject({ reached: true });
  });

  it('a focused container does not count as reaching a control inside it', async () => {
    const { page } = await open('<main tabindex="-1"><button>Save</button></main>');
    await page.focus('main');
    expect(await focusWalk(page, button('Save'))).toMatchObject({ reached: true, tabs: 1 });
  });
});

describe('probeReachable', () => {
  it('static text is not a control', async () => {
    const { page } = await open('<button>A</button><p>Total</p>');
    expect(await probeReachable(page, { text: 'Total' })).toBe('missing');
  });

  it('visible for a shown, enabled target', async () => {
    const { page } = await open();
    expect(await probeReachable(page, button('Pay'))).toBe('visible');
  });

  it.each(['Locked', 'Hidden', 'Missing'])('missing for %s', async (name) => {
    const { page } = await open();
    expect(await probeReachable(page, button(name))).toBe('missing');
  });
});

describe('startActor with keyboard (F20)', () => {
  async function env(onStep: (r: StepResult, xy?: { x: number; y: number }) => void = () => undefined) {
    const { page, context } = await open();
    return {
      actor: 'a' as const,
      page,
      context,
      origin: ORIGIN,
      loaded,
      holds: await installHolds(context, ORIGIN),
      barriers: new BarrierSet(['a']),
      seed: 1,
      stepTimeoutMs: 2000,
      onStep,
      keyboard: true as const,
    };
  }

  it('a visible control it cannot reach is recorded as unreachable', async () => {
    const run = await runActor([{ focus: button('Pay') }], await env());
    expect(run.end).toBe('failed');
    expect(run.steps[0]?.unreachable).toBe('button "Pay" can\'t be reached with Tab');
  });

  it('a disabled control is a plain failure', async () => {
    const run = await runActor([{ focus: button('Locked') }], await env());
    expect(run.end).toBe('failed');
    expect(run.steps[0]?.unreachable).toBeUndefined();
    expect(run.error).toMatch(/not visible or disabled/);
  });

  it('waits for a control that renders late instead of blaming the app', async () => {
    const e = await env();
    await e.page.setContent('<button>A</button><script>setTimeout(() => document.body.insertAdjacentHTML("beforeend", "<button>Late</button>"), 300);</script>');
    const run = await runActor([{ focus: button('Late') }], e);
    expect(run.end).toBe('done');
  });

  it('a keyboard fill that lands on something that is not a field fails as the plan\'s fault', async () => {
    const run = await runActor([{ fill: { target: button('Save'), input: { generator: 'plain' } } }], await env());
    expect(run.end).toBe('failed');
    expect(run.steps[0]?.unreachable).toBeUndefined();
    expect(run.error).toMatch(/not a text field/);
  });

  it('fills by typing and activates with Enter', async () => {
    const xys: ({ x: number; y: number } | undefined)[] = [];
    const e = await env((_, xy) => xys.push(xy));
    const steps: Step[] = [{ fill: { target: { label: 'Name' }, input: { generator: 'plain' } } }, { focus: button('Save') }, { press: 'Enter' }];
    const run = await runActor(steps, e);
    expect(run.end).toBe('done');
    expect(await e.page.textContent('#out')).toBe(`Saved ${generate('plain', 1, 0)}`);
    expect(run.steps[1]?.note).toBe('reached after 1 Tab');
    expect(xys[0]).toBeDefined();
    expect(xys[1]).toBeDefined();
  });
});
