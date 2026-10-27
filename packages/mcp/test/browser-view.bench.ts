/** Fixture-only benchmark: node --import tsx packages/mcp/test/browser-view.bench.ts [poll|stream] */
import { chromium } from 'playwright';
import { setTimeout as delay } from 'node:timers/promises';
import { createBrowserDriver } from '../src/computer/driver.ts';
import type { BrowserFrame } from '@pitchcrew/core';

const mode = process.argv[2] ?? 'poll';
if (mode !== 'poll' && mode !== 'stream') throw new Error('Choose poll or stream.');
const browser = await chromium.launch({ headless: true });
const driver = await createBrowserDriver(browser);
const viewer = await browser.newPage({ viewport: { width: 800, height: 600 } });
// BrowserDriver owns a separate context; inspect it through the browser only in this fixture.
const page = browser
  .contexts()
  .find((context) => context !== viewer.context())!
  .pages()[0];
const html = `<style>body {margin:0} #marker {position:fixed;left:0;top:0;width:64px;height:64px;background:rgb(0,0,0)}
input {position:fixed;left:100px;top:10px} main {height:20000px;background:repeating-linear-gradient(#fff 0 40px,#bbb 40px 80px)}</style>
<div id="marker"></div><input autofocus oninput="document.querySelector('#marker').style.background='rgb('+(this.value.length*10)+',0,0)'"><main></main>`;
await page.setContent(html);
await page.locator('input').focus();
let stopped = false;
let latest: BrowserFrame | undefined;
let decoding = false;
let seen = 0;
let count = 0;
let bytes = 0;
const receive = (frame: BrowserFrame) => {
  if (!frame.screenshot || stopped) return;
  latest = frame;
  const present = async () => {
    if (decoding || !latest || stopped) return;
    decoding = true;
    const next = latest;
    latest = undefined;
    try {
      seen = await viewer.evaluate(async (screenshot) => {
        const image = new Image();
        image.src = `data:image/jpeg;base64,${screenshot}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0);
        return Math.round(context.getImageData(8, 8, 1, 1).data[0] / 10);
      }, next.screenshot);
      count++;
      bytes += next.screenshot.length;
    } finally {
      decoding = false;
      if (latest) void present();
    }
  };
  void present();
};
const cpu = process.cpuUsage();
const began = performance.now();
let stop = () => {};
const polling = async () => {
  while (!stopped) {
    receive(await driver.frame!());
    await delay(350);
  }
};
let poll: Promise<void> | undefined;
if (mode === 'stream') {
  if (!driver.subscribeFrames) throw new Error('Streaming is unavailable.');
  stop = driver.subscribeFrames((event) => {
    if ('error' in event) throw new Error(event.error);
    receive(event);
  });
} else poll = polling();
const waitFor = async (ready: () => boolean) => {
  const deadline = performance.now() + 5000;
  while (!ready()) {
    if (performance.now() > deadline) throw new Error('Fixture view timed out.');
    await delay(5);
  }
};
try {
  await waitFor(() => count > 0);
  const latencies: number[] = [];
  for (let i = 1; i <= 12; i++) {
    // Vary phase relative to the capture loop instead of synchronizing every input with a frame.
    await delay(25 + ((i * 71) % 200));
    const start = performance.now();
    await driver.input!({ kind: 'text', text: 'x' });
    await waitFor(() => seen === i);
    latencies.push(performance.now() - start);
  }
  const framesBefore = count;
  const scrollStart = performance.now();
  for (let i = 0; i < 60; i++) {
    await driver.input!({ kind: 'scroll', deltaY: 80, deltaX: 0 });
    await delay(16);
  }
  await delay(250);
  const duration = performance.now() - began;
  const sorted = latencies.toSorted((a, b) => a - b);
  const consumed = process.cpuUsage(cpu);
  console.log(
    JSON.stringify({
      mode,
      samples: latencies.length,
      medianMs: Math.round(sorted[Math.floor(sorted.length / 2)]),
      p95Ms: Math.round(sorted.at(-1)!),
      scrollingFramesPerSecond: Number(
        ((count - framesBefore) / ((performance.now() - scrollStart) / 1000)).toFixed(1),
      ),
      deliveredBase64Bytes: bytes,
      elapsedMs: Math.round(duration),
      nodeCpuMs: Math.round((consumed.user + consumed.system) / 1000),
      nodeRssMiB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    }),
  );
} finally {
  stopped = true;
  stop();
  await poll;
  while (decoding) await delay(5);
  await driver.close();
  await browser.close();
}
