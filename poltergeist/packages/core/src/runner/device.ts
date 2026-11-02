import type { BrowserContextOptions, Locator, Page } from 'playwright-core';
import type { PlanTarget } from '../compiler/dsl.js';
import type { DevicePreset } from '../personas/devices.js';
import { locateTarget } from '../scout/login.js';

/** How long the probe waits for the page to settle, and its hard limit (it runs after a step timeout). */
const SETTLE_MS = 2000;
const PROBE_MS = 2500;

/** Context options for a persona's fixed device (F16, D-44). They go through `newGuardedContext`. */
export function deviceContextOptions(d: DevicePreset): Pick<BrowserContextOptions, 'viewport' | 'isMobile' | 'hasTouch' | 'deviceScaleFactor'> {
  return { viewport: { ...d.viewport }, isMobile: d.isMobile, hasTouch: d.hasTouch, deviceScaleFactor: 1 };
}

/** The device's slower CPU, through CDP (Chromium only). Once per page, before the first step. */
export async function applyDevice(page: Page, d: DevicePreset): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: d.cpuSlowdown });
}

export function describeTarget(t: PlanTarget): string {
  if ('role' in t) return `${t.role} "${t.name}"`;
  if ('label' in t) return `field labelled "${t.label}"`;
  if ('text' in t) return `text "${t.text}"`;
  return `test id "${t.testId}"`;
}

/** Like `locateTarget`, but a role target also matches elements hidden from the accessibility tree. */
function locateAny(page: Page, t: PlanTarget): Locator {
  if ('role' in t) return page.getByRole(t.role as Parameters<Page['getByRole']>[0], { name: t.name, exact: true, includeHidden: true });
  return locateTarget(page, t);
}

/**
 * Why a target that timed out can't be used on this device (D-44, KI-39): it is on the page, but once the
 * network is idle no match of it is visible (for example hidden by a small-screen layout). `undefined` when
 * it is missing, any match is visible, it is only disabled (correct while a slow request runs), or the page
 * hasn't settled (it may still be loading). Off-screen targets don't count: mobile layouts widen to fit
 * them and Playwright scrolls them into view. Never throws.
 */
export async function probeUsable(page: Page, target: PlanTarget): Promise<string | undefined> {
  let timer: NodeJS.Timeout | undefined;
  const limit = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), PROBE_MS);
  });
  const probe = (async () => {
    const settled = await page.waitForLoadState('networkidle', { timeout: SETTLE_MS }).then(() => true, () => false);
    if (!settled) return undefined;
    const matches = await locateAny(page, target).all();
    if (matches.length === 0) return undefined;
    for (const m of matches) if (await m.isVisible()) return undefined;
    return `${describeTarget(target)} is on the page but not visible`;
  })().catch(() => undefined);
  return Promise.race([probe, limit]).finally(() => clearTimeout(timer));
}
