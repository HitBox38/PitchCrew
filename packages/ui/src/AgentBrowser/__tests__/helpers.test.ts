import { describe, expect, it } from 'vitest';
import { remotePoint, touchScroll } from '../helpers.ts';

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
