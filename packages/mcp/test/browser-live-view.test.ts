import type { BrowserFrame } from '@pitchcrew/core';
import { chromium, type Browser, type Page } from 'playwright';
import { afterEach, expect, it, vi } from 'vitest';
import { createBrowserDriver } from '../src/computer/driver.ts';

const browsers: Browser[] = [];
afterEach(async () => {
  for (const browser of browsers.splice(0)) await browser.close();
});
const fixture = async () => {
  const browser = await chromium.launch({ headless: true });
  browsers.push(browser);
  const driver = await createBrowserDriver(browser);
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  await page.setContent(
    '<title>First page</title><input id="name"><div style="background:red;width:200px;height:100px">First</div>',
  );
  const frames: BrowserFrame[] = [];
  const errors: string[] = [];
  const screenshot = vi.spyOn(page, 'screenshot');
  const stop = driver.subscribeFrames!((frame) =>
    'error' in frame ? errors.push(frame.error) : frames.push(frame),
  );
  const live = async (predicate: (frame: BrowserFrame) => boolean = () => true) => {
    await vi.waitFor(
      () =>
        expect(
          frames.some((frame) => frame.status === 'live' && !!frame.screenshot && predicate(frame)),
        ).toBe(true),
      { timeout: 5000 },
    );
    return frames.findLast(
      (frame) => frame.status === 'live' && !!frame.screenshot && predicate(frame),
    )!;
  };
  return { driver, context, page, frames, errors, screenshot, stop, live };
};

it('streams real Chromium frames without screenshot polling, keeps static metadata fresh and releases capture', async () => {
  const { driver, page, frames, screenshot, errors, live, stop } = await fixture();
  const first = await live();
  expect(first).toMatchObject({ width: 1280, height: 800 });
  await page.locator('#name').focus();
  await driver.input!({ kind: 'text', text: 'Fictional person' });
  await live((frame) => frame.screenshot !== first.screenshot);
  await page.evaluate(() => {
    document.title = 'Changed without navigation';
  });
  await vi.waitFor(() => expect(frames.at(-1)?.title).toBe('Changed without navigation'), {
    timeout: 3000,
  });
  const dialog = new Promise<void>((resolve) => page.once('dialog', () => resolve()));
  await page.evaluate(() => {
    setTimeout(() => alert('Fictional confirmation'), 0);
  });
  await dialog;
  await vi.waitFor(() => expect(frames.at(-1)?.dialog?.message).toBe('Fictional confirmation'));
  await driver.input!({ kind: 'dialog', decision: 'dismiss' });
  await vi.waitFor(() => expect(frames.at(-1)?.dialog).toBeUndefined());
  expect(screenshot).not.toHaveBeenCalled();
  stop();
  const count = frames.length;
  await page.evaluate(() => {
    document.body.style.background = 'blue';
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(frames).toHaveLength(count);
  expect(errors).toEqual([]);
  await driver.close();
});

it('follows resized pages, owned popups and page replacement while rejecting stale clicks', async () => {
  const { driver, context, frames, errors, live } = await fixture();
  const original = await live();
  await driver.resize!({ width: 390, height: 920 });
  const resized = await live((frame) => frame.width === 390 && frame.height === 920);
  expect(resized.generation).not.toBe(original.generation);
  await expect(
    driver.input!({ kind: 'click', generation: original.generation, x: 10, y: 10 }),
  ).rejects.toThrow('page changed');
  const popup: Page = await context.newPage();
  await popup.setContent('<title>Popup page</title><h1>Popup</h1>');
  const popupFrame = await live((frame) => frame.title === 'Popup page');
  expect(popupFrame).toMatchObject({ width: 390, height: 920 });
  await popup.close();
  await live((frame) => frame.generation! > popupFrame.generation! && frame.title === 'First page');
  await driver.freshPage!();
  await live((frame) => frame.generation! > popupFrame.generation! && frame.url === 'about:blank');
  expect(frames.some((frame) => frame.status === 'loading' && !frame.screenshot)).toBe(true);
  expect(errors).toEqual([]);
  await driver.close();
});

it('keeps five simultaneous job pages independent and shares capture with a second viewer', async () => {
  const { driver, context, page, live } = await fixture();
  await live();
  const start = vi.spyOn(page.screencast, 'start');
  const extraViewer: BrowserFrame[] = [];
  const stopExtra = driver.subscribeFrames!((event) => {
    if (!('error' in event)) extraViewer.push(event);
  });
  const others: {
    driver: Awaited<ReturnType<typeof createBrowserDriver>>;
    frames: BrowserFrame[];
    stop: () => void;
  }[] = [];
  for (let i = 0; i < 4; i++) {
    const next = await driver.newTab!();
    const current = context.pages().at(-1)!;
    await current.setContent(
      `<title>Job ${i}</title><body style="background:rgb(${i * 50},0,0)">Job ${i}</body>`,
    );
    const frames: BrowserFrame[] = [];
    const stop = next.subscribeFrames!((event) => {
      if (!('error' in event)) frames.push(event);
    });
    others.push({ driver: next, frames, stop });
  }
  await vi.waitFor(
    () => {
      for (let i = 0; i < others.length; i++)
        expect(
          others[i].frames.some((frame) => frame.status === 'live' && frame.title === `Job ${i}`),
        ).toBe(true);
    },
    { timeout: 5000 },
  );
  expect(start).not.toHaveBeenCalled(); // A second viewer reused the original capture.
  expect(extraViewer.some((frame) => frame.title === 'First page')).toBe(true);
  stopExtra();
  for (const item of others) {
    item.stop();
    await item.driver.close();
  }
  expect((await driver.snapshot()).title).toBe('First page');
  await driver.close();
});
