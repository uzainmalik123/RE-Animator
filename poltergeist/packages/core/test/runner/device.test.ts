import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { parseConfig, type LoadedConfig } from '../../src/config/load.js';
import { getDevice } from '../../src/personas/index.js';
import { runActor } from '../../src/runner/actor.js';
import { BarrierSet } from '../../src/runner/barrier.js';
import { applyDevice, deviceContextOptions, probeUsable } from '../../src/runner/device.js';
import { installHolds } from '../../src/runner/holds.js';
import { guardLaunchOptions, newGuardedContext } from '../../src/safety/guard.js';

const ORIGIN = 'http://127.0.0.1:9';
const PHONE = getDevice('small-slow');

const PAGE = `<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body>
<button>Visible</button>
<button style="display:none">Hidden</button>
<button disabled>Locked</button>
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

async function phonePage(device = true): Promise<{ page: Page; context: BrowserContext }> {
  const context = await newGuardedContext(browser, { allowedHosts: loaded.allowedHosts }, device ? deviceContextOptions(PHONE) : {});
  contexts.push(context);
  const page = await context.newPage();
  await page.setContent(PAGE);
  return { page, context };
}

const button = (name: string) => ({ role: 'button', name });

describe('deviceContextOptions', () => {
  it('gives the small-slow phone its viewport, mobile and touch flags', async () => {
    expect(deviceContextOptions(PHONE)).toEqual({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const { page } = await phonePage();
    expect(page.viewportSize()).toEqual({ width: 360, height: 640 });
    expect(await page.evaluate('window.innerWidth')).toBe(360);
  });

  it('applyDevice slows the CPU without failing', async () => {
    const { page } = await phonePage();
    await expect(applyDevice(page, PHONE)).resolves.toBeUndefined();
  });
});

describe('probeUsable', () => {
  it('names a target that is on the page but not visible', async () => {
    const { page } = await phonePage();
    expect(await probeUsable(page, button('Hidden'))).toBe('button "Hidden" is on the page but not visible');
  });

  it('finds hidden label and test id targets too', async () => {
    const { page } = await phonePage();
    await page.setContent('<label for="q" style="display:none">Qty</label><input id="q" style="display:none"><b data-testid="t" hidden>x</b>');
    expect(await probeUsable(page, { label: 'Qty' })).toBe('field labelled "Qty" is on the page but not visible');
    expect(await probeUsable(page, { testId: 't' })).toBe('test id "t" is on the page but not visible');
  });

  it.each(['Visible', 'Locked', 'Missing'])('returns undefined for %s (usable, disabled or absent)', async (name) => {
    const { page } = await phonePage();
    expect(await probeUsable(page, button(name))).toBeUndefined();
  });

  it('never throws on a closed page', async () => {
    const { page } = await phonePage();
    await page.close();
    expect(await probeUsable(page, button('Hidden'))).toBeUndefined();
  });
});

describe('startActor on a device', () => {
  async function actorEnv(device: boolean) {
    const { page, context } = await phonePage(device);
    return {
      actor: 'a' as const,
      page,
      context,
      origin: ORIGIN,
      loaded,
      holds: await installHolds(context, ORIGIN),
      barriers: new BarrierSet(['a']),
      seed: 1,
      stepTimeoutMs: 500,
      onStep: () => undefined,
      ...(device ? { device: PHONE } : {}),
    };
  }

  it('records why a timed-out click target was unusable', async () => {
    const run = await runActor([{ click: button('Hidden') }], await actorEnv(true));
    expect(run.end).toBe('timeout');
    expect(run.steps[0]?.unusable).toMatch(/not visible/);
  });

  it('a disabled target stays a plain timeout', async () => {
    const run = await runActor([{ click: button('Locked') }], await actorEnv(true));
    expect(run.end).toBe('timeout');
    expect(run.steps[0]?.unusable).toBeUndefined();
  });

  it('without a device nothing is probed', async () => {
    const run = await runActor([{ click: button('Hidden') }], await actorEnv(false));
    expect(run.end).toBe('timeout');
    expect(run.steps[0]?.unusable).toBeUndefined();
  });
});
