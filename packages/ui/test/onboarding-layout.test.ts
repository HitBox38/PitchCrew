import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;

beforeAll(async () => {
  host = await setup();
  host.daemon.service.onboarding.save({ version: 1, status: 'setup', step: 0 });
  browser = await chromium.launch({ headless: true });
}, 60000);

afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test('setup actions remain reachable by touch in short and narrow windows', async () => {
  const context = await browser.newContext({ hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    for (const viewport of [
      { width: 568, height: 320 },
      { width: 320, height: 480 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(host.daemon.url);
      const checklist = page.getByRole('region', { name: 'Make this workspace yours' });
      await checklist.waitFor({ timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      const bounds = await checklist.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { bottom: rect.bottom, viewport: innerHeight };
      });
      expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewport);
      const later = checklist.getByRole('button', { name: 'Set up later' });
      await later.scrollIntoViewIfNeeded();
      const target = await later.boundingBox();
      expect(target!.y + target!.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.getByRole('button', { name: 'Set up later' }).tap();
    await expect.poll(() => page.locator('.onboarding-checklist').count()).toBe(0);
    expect(host.daemon.service.onboarding.get().status).toBe('dismissed');
  } finally {
    await context.close();
  }
});

test('a populated compact Board keeps both setup and job actions reachable', async () => {
  host.daemon.service.onboarding.save({ version: 1, status: 'setup', step: 0 });
  const card = host.daemon.service.createCard({ company: 'Fictional Studio', title: 'Engineer' });
  const context = await browser.newContext({
    viewport: { width: 568, height: 320 },
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  try {
    await page.goto(host.daemon.url);
    const job = page.locator(`#board-job-${card.id} .clay-job-card`);
    await job.waitFor({ timeout: 30000 });
    expect(
      await page.locator('#stage-lead .clay-column-body').evaluate((e) => e.clientHeight),
    ).toBeGreaterThanOrEqual(120);
    await job.scrollIntoViewIfNeeded();
    await job.tap();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const later = page.getByRole('button', { name: 'Set up later' });
    await later.scrollIntoViewIfNeeded();
    await later.tap();
    await expect.poll(() => page.locator('.onboarding-checklist').count()).toBe(0);
  } finally {
    await context.close();
  }
});
