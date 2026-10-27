import type { BrowserFrame } from '@pitchcrew/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { browserFramePresenter } from '../frame-presenter.ts';

const images: { src: string; resolve: () => void; reject: () => void }[] = [];
const callbacks = new Map<number, FrameRequestCallback>();
let sequence = 0;
beforeEach(() => {
  images.length = 0;
  callbacks.clear();
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      decode = () =>
        new Promise<void>((resolve, reject) => {
          images.push({ src: this.src, resolve, reject });
        });
    },
  );
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.set(++sequence, callback);
    return sequence;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
});
afterEach(() => vi.unstubAllGlobals());
const frame = (screenshot: string, generation = 1): BrowserFrame => ({
  screenshot,
  generation,
  width: 1280,
  height: 800,
  url: 'https://example.com',
  title: 'Fixture',
});
const paint = async () => {
  await Promise.resolve();
  for (const [id, callback] of callbacks) {
    callbacks.delete(id);
    callback(0);
  }
  await Promise.resolve();
};

it('decodes one image at a time and skips obsolete pending frames without starving painting', async () => {
  const receive = vi.fn();
  const presenter = browserFramePresenter(receive, vi.fn());
  presenter.push(frame('first'));
  for (let i = 0; i < 1000; i++) presenter.push(frame(`${i}`));
  expect(images).toHaveLength(1);
  images[0].resolve();
  await paint();
  expect(receive).toHaveBeenLastCalledWith(frame('first'));
  expect(images).toHaveLength(2);
  expect(images[1].src.endsWith(',999')).toBe(true);
  images[1].resolve();
  await paint();
  expect(receive).toHaveBeenLastCalledWith(frame('999'));
  presenter.close();
});

it('clears the old view immediately and rejects late decode results after a page or size change', async () => {
  const receive = vi.fn();
  const presenter = browserFramePresenter(receive, vi.fn());
  presenter.push(frame('old', 1));
  presenter.push({ ...frame('', 2), status: 'loading', width: 390, height: 920 });
  presenter.push({ ...frame('new', 2), width: 390, height: 920 });
  expect(receive).toHaveBeenLastCalledWith(
    expect.objectContaining({ generation: 2, screenshot: '', status: 'loading' }),
  );
  images[0].resolve();
  await paint();
  expect(receive.mock.calls.every(([value]) => !value.screenshot)).toBe(true);
  images[1].resolve();
  await paint();
  expect(receive).toHaveBeenLastCalledWith(
    expect.objectContaining({ generation: 2, screenshot: 'new', width: 390 }),
  );
  presenter.close();
});

it('cancels a pending presentation on disconnect and never updates the closed view', async () => {
  const receive = vi.fn();
  const failed = vi.fn();
  const presenter = browserFramePresenter(receive, failed);
  presenter.push(frame('old'));
  images[0].resolve();
  await Promise.resolve();
  expect(callbacks.size).toBe(1);
  presenter.close();
  expect(callbacks.size).toBe(0);
  await paint();
  presenter.push(frame('late'));
  expect(receive).toHaveBeenCalledTimes(1); // Initial loading state only.
  expect(failed).not.toHaveBeenCalled();
});
