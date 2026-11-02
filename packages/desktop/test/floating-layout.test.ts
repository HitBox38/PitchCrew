import { expect, it } from 'vitest';
import { floatingContentSize, floatingToolbarHeight } from '../src/browser/floating-layout.ts';

it('opens a tall mobile viewport at actual size when the screen has room', () => {
  expect(floatingContentSize({ width: 600, height: 1130 }, { width: 2300, height: 1240 })).toEqual({
    width: 600,
    height: 1130 + floatingToolbarHeight,
  });
});

it.each([
  { width: 600, height: 1130 },
  { width: 390, height: 844 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 2160 },
])('fits $width × $height into a smaller display without losing its aspect ratio', (page) => {
  const available = { width: 1000, height: 800 };
  const size = floatingContentSize(page, available);
  expect(size.width).toBeLessThanOrEqual(available.width);
  expect(size.height).toBeLessThanOrEqual(available.height);
  expect(size.width).toBeGreaterThanOrEqual(400);
  const scale = (size.height - floatingToolbarHeight) / page.height;
  expect(scale).toBeLessThanOrEqual(1);
  expect(size.width).toBeGreaterThanOrEqual(Math.floor(page.width * scale));
});

it('keeps a narrow secondary display bounded, including controls', () => {
  const size = floatingContentSize({ width: 600, height: 1130 }, { width: 350, height: 600 });
  expect(size.width).toBe(350);
  expect(size.height).toBeLessThanOrEqual(600);
});

it('uses the available height even when a short display needs less than 50% scale', () => {
  const page = { width: 600, height: 1130 };
  const size = floatingContentSize(page, { width: 926, height: 597 });
  expect(size).toEqual({ width: 400, height: 597 });
  const scale = (size.height - floatingToolbarHeight) / page.height;
  expect(scale).toBeLessThan(0.5);
  expect(page.width * scale).toBeCloseTo(278.76, 2);
});
