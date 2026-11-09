import { describe, expect, it } from 'vitest';
import {
  addressParts,
  browserTabLabel,
  normalizeAddress,
  remotePoint,
  touchScroll,
} from '../helpers.ts';
import { movedTabOrder } from '../tab-drag.ts';
import { revealScroll } from '../helpers.ts';

describe('manual browser coordinates', () => {
  const frame = { width: 1280, height: 800 };
  it('targets the same field in fit, zoomed and locally panned views', () => {
    expect(remotePoint(360, 250, { left: 200, top: 150, width: 640, height: 400 }, frame)).toEqual({
      x: 320,
      y: 200,
    });
    expect(remotePoint(520, 350, { left: 200, top: 150, width: 1280, height: 800 }, frame)).toEqual(
      { x: 320, y: 200 },
    );
    expect(remotePoint(220, 250, { left: -100, top: 50, width: 1280, height: 800 }, frame)).toEqual(
      { x: 320, y: 200 },
    );
  });
  it('keeps pointer targets inside the accepted remote viewport', () => {
    const bounds = { left: 20, top: 30, width: 640, height: 400 };
    expect(remotePoint(-5, -10, bounds, frame)).toEqual({ x: 0, y: 0 });
    expect(remotePoint(1000, 900, bounds, frame)).toEqual({ x: 1280, y: 800 });
  });
  it('maps upward and downward swipes consistently at different zoom levels', () => {
    expect(touchScroll(200, 100, 400, 800)).toBe(200);
    expect(touchScroll(100, 200, 400, 800)).toBe(-200);
    expect(touchScroll(300, 100, 800, 800)).toBe(200);
  });
  it('bounds large swipes to the manual-input contract', () => {
    expect(touchScroll(1000, 0, 200, 800)).toBe(2000);
    expect(touchScroll(0, 1000, 200, 800)).toBe(-2000);
  });
});

describe('address display', () => {
  it('splits web addresses into host and path', () => {
    expect(addressParts('https://boards.greenhouse.io/waypoint/jobs/1?gh=1#apply')).toEqual({
      host: 'boards.greenhouse.io',
      rest: '/waypoint/jobs/1?gh=1#apply',
    });
    expect(addressParts('https://example.com/')).toEqual({ host: 'example.com', rest: '' });
  });

  it('leaves blank and non-web addresses to the plain field', () => {
    expect(addressParts('')).toBeNull();
    expect(addressParts('about:blank')).toBeNull();
    expect(addressParts('file:///etc/hosts')).toBeNull();
  });
});

describe('browser chrome labels', () => {
  it('labels a tab by title, then the host it loads or failed on, then New tab', () => {
    expect(browserTabLabel({ title: 'Jobs at Fictional Co', url: 'https://jobs.example' })).toBe(
      'Jobs at Fictional Co',
    );
    expect(
      browserTabLabel({
        title: 'about:blank',
        url: 'about:blank',
        navigationUrl: 'https://missing.example/path',
      }),
    ).toBe('missing.example');
    expect(browserTabLabel({ title: '', url: 'about:blank' })).toBe('New tab');
  });
  it('keeps web addresses, adds https to bare hosts and searches everything else', () => {
    expect(normalizeAddress(' https://example.com/a ')).toBe('https://example.com/a');
    expect(normalizeAddress('example.com/jobs')).toBe('https://example.com/jobs');
    expect(normalizeAddress('fictional co careers')).toBe(
      'https://www.google.com/search?q=fictional%20co%20careers',
    );
  });
});

it('moves a tab to a clamped position and ignores unknown tabs', () => {
  expect(movedTabOrder(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
  expect(movedTabOrder(['a', 'b', 'c'], 'a', 5)).toEqual(['b', 'c', 'a']);
  expect(movedTabOrder(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
  expect(movedTabOrder(['a', 'b'], 'x', 0)).toEqual(['a', 'b']);
});

it('reveals a tab clear of both edge fades, even in a narrow strip', () => {
  const strip = { width: 136, content: 600, fade: 16 };
  // A 96px tab at [196, 292] from scroll 0: both edges end up inside the readable span.
  const next = revealScroll({ ...strip, start: 196, end: 292, scroll: 0 });
  expect(196 - next).toBeGreaterThanOrEqual(16);
  expect(292 - next).toBeLessThanOrEqual(136 - 16);
  // A tab under the start fade moves right, and one already readable stays put.
  expect(revealScroll({ ...strip, start: 205, end: 301, scroll: 200 })).toBe(189);
  expect(revealScroll({ ...strip, start: 230, end: 300, scroll: 200 })).toBe(200);
  // The first tab returns to the very start, where there is no start fade.
  expect(revealScroll({ ...strip, start: 0, end: 96, scroll: 50 })).toBe(0);
});
