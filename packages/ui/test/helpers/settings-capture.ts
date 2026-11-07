import type { Page } from 'playwright';
import { resolve } from 'node:path';

/** Capture real nested-scroll viewports with overlap; fullPage alone cannot reveal these panels. */
export const captureSettings = async (page: Page, name: string) => {
  const output = process.env.PITCHCREW_SETTINGS_EVIDENCE;
  if (!output) return;
  const panel = page.locator('.settings-content:not([hidden])');
  const { height, total } = await panel.evaluate((e) => ({
    height: e.clientHeight,
    total: e.scrollHeight,
  }));
  const step = Math.max(200, height - 140);
  const stops = Array.from(
    { length: Math.max(1, Math.ceil((total - height) / step) + 1) },
    (_, i) => Math.min(i * step, total - height),
  );
  for (let i = 0; i < stops.length; i++) {
    await panel.evaluate((e, top) => e.scrollTo({ top, behavior: 'instant' }), stops[i]);
    await page.screenshot({ path: resolve(output, `${name}${i ? `-part${i + 1}` : ''}.png`) });
  }
};
