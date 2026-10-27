import { chromium, type Browser, type Page } from 'playwright';
import { defaultCapabilities, type Role } from '@pitchcrew/core';
import { createBrowserDriver } from '../../mcp/src/computer.ts';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { setup, cleanup } from './helpers/daemon.ts';
import { writeFile } from 'node:fs/promises';

let browser: Browser;
let computerBrowser: Browser;
let page: Page;
let website: Page;
let host: Awaited<ReturnType<typeof setup>>;
let subscriptions = 0;
const errors: string[] = [];
beforeAll(async () => {
  computerBrowser = await chromium.launch({ headless: true });
  const driver = await createBrowserDriver(computerBrowser);
  const subscribe = driver.subscribeFrames!;
  driver.subscribeFrames = (receive) => {
    subscriptions++;
    const stop = subscribe(receive);
    return () => {
      subscriptions--;
      stop();
    };
  };
  website = computerBrowser.contexts()[0].pages()[0];
  await website.setContent(`<title>Fictional application</title><style>
    body{margin:0} #marker{position:fixed;left:0;top:0;width:64px;height:64px;background:rgb(0,0,0)}
    input{position:fixed;left:100px;top:80px;width:200px} main{height:20000px;background:repeating-linear-gradient(#fff 0 40px,#bbb 40px 80px)}
    </style><div id="marker"></div><input id="name" oninput="document.querySelector('#marker').style.background='rgb('+(this.value.length*10)+',0,0)'"><main></main>`);
  host = await setup(23949, false, { browserLaunch: async () => driver });
  const service = host.daemon.service;
  const role = service.board.get<Role>('role', 'writer');
  service.board.record(
    'role',
    { ...role, capabilities: { ...defaultCapabilities, ...role.capabilities, computerUse: true } },
    'user',
    'Enable fixture browser',
  );
  await service.computer.openBrowser('writer', 'writer', null);
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${host.daemon.url}/chat/writer`, { waitUntil: 'domcontentloaded' });
  await page.locator('button[aria-controls="agent-browser-panel"]').waitFor({ timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
  await page.locator('button[aria-controls="agent-browser-panel"]').click();
  await page.locator('.browser-live-view img').waitFor();
}, 60000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
  await computerBrowser?.close();
});

const marker = () =>
  page.locator('.browser-live-view img').evaluate((element) => {
    const image = element as HTMLImageElement;
    if (!image.complete || !image.naturalWidth) return -1;
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    return Math.round(context.getImageData(8, 8, 1, 1).data[0] / 10);
  });

test('takes private control, presents typed changes through the real HTTP stream and resumes cleanly', async () => {
  await page.getByRole('button', { name: 'Take control', exact: true }).click();
  await page.getByRole('button', { name: 'Return to agent', exact: true }).waitFor();
  await vi.waitFor(() => expect(website.viewportSize()!.width).toBeLessThan(1000));
  const target = (await website.locator('#name').boundingBox())!;
  const surface = page.locator('.browser-screen');
  const bounds = (await surface.boundingBox())!;
  const scale = bounds.width / website.viewportSize()!.width;
  await surface.click({ position: { x: (target.x + 20) * scale, y: (target.y + 10) * scale } });
  await vi.waitFor(async () =>
    expect(
      await website.locator('#name').evaluate((element) => document.activeElement === element),
    ).toBe(true),
  );
  const latencies: number[] = [];
  for (let i = 1; i <= 12; i++) {
    const started = performance.now();
    await page.keyboard.type('x');
    await vi.waitFor(async () => expect(await marker()).toBe(i), { interval: 5, timeout: 5000 });
    latencies.push(performance.now() - started);
  }
  const sorted = latencies.toSorted((a, b) => a - b);
  await writeFile(
    '/tmp/pitchcrew-browser-ui-benchmark.json',
    JSON.stringify({
      fixture:
        'UI keyboard → HTTP input → Chromium → HTTP frames → image decode → displayed pixels',
      samples: sorted.length,
      medianMs: Math.round(sorted[Math.floor(sorted.length / 2)]),
      p95Ms: Math.round(sorted.at(-1)!),
    }),
  );
  expect(JSON.stringify(host.daemon.service.board.events())).not.toContain('xxxxxxxxxxxx');
  await page.getByRole('button', { name: 'Return to agent', exact: true }).click();
  await page.getByRole('button', { name: 'Take control', exact: true }).waitFor();
  expect(host.daemon.service.computer.browsers.list()[0].manual).toBe(false);
  expect(errors).toEqual([]);
});

test('unsubscribes when the panel is hidden and reconnects without changing manual pause', async () => {
  await page.getByRole('button', { name: 'Take control', exact: true }).click();
  await page.getByRole('button', { name: 'Return to agent', exact: true }).waitFor();
  await page.locator('button[aria-controls="agent-browser-panel"]').click();
  await vi.waitFor(() => expect(subscriptions).toBe(0));
  expect(host.daemon.service.computer.browsers.list()[0].manual).toBe(true);
  await page.locator('button[aria-controls="agent-browser-panel"]').click();
  await page.locator('.browser-live-view img').waitFor();
  await vi.waitFor(() => expect(subscriptions).toBe(1));
  await page.getByRole('button', { name: 'Return to agent', exact: true }).click();
  expect(errors).toEqual([]);
});

test('suspends viewing while the app document is hidden without releasing private control', async () => {
  await page.getByRole('button', { name: 'Take control', exact: true }).click();
  await page.getByRole('button', { name: 'Return to agent', exact: true }).waitFor();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await vi.waitFor(() => expect(subscriptions).toBe(0));
  expect(host.daemon.service.computer.browsers.list()[0].manual).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.locator('.browser-live-view img').waitFor();
  await vi.waitFor(() => expect(subscriptions).toBe(1));
  await page.getByRole('button', { name: 'Return to agent', exact: true }).click();
  expect(errors).toEqual([]);
});
