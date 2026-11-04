// The render vital: the revived app loads in headless Chromium with no uncaught page errors and
// shows some text. Requests to anything but loopback are aborted (we only ever touch the local app).
import { chromium } from 'playwright-core';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

export async function renderCheck(origin: string, o: { timeoutMs?: number } = {}): Promise<{ ok: boolean; detail: string }> {
  const timeout = o.timeoutMs ?? 20_000;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.route('**/*', (route) => {
      const host = new URL(route.request().url()).hostname;
      return LOOPBACK.has(host) ? route.continue() : route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(origin, { waitUntil: 'load', timeout });
    const text = (await page.locator('body').innerText({ timeout })).trim();
    if (errors.length > 0) return { ok: false, detail: `page error: ${errors[0]}` };
    if (text === '') return { ok: false, detail: 'the page rendered no text' };
    return { ok: true, detail: `rendered: ${text.split('\n')[0]!.slice(0, 80)}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message.split('\n')[0]! : String(e) };
  } finally {
    await browser.close();
  }
}
