import { expect, test } from 'vitest';
import { fitScale, fitOptions, shownZoom, steppedZoom } from '../zoom.ts';

const letter = { width: 612, height: 792 };

test('Automatic fits narrow trays and never enlarges a portrait page past 125%', () => {
  expect(fitScale('auto', letter, { width: 306, height: 900 })).toBe(0.5);
  expect(fitScale('auto', letter, { width: 2000, height: 900 })).toBe(1.25);
  expect(fitScale('width', letter, { width: 2000, height: 900 })).toBeCloseTo(3.268, 3);
});

test('Automatic fits a landscape page whole, like Fit page', () => {
  const landscape = { width: 792, height: 612 };
  const room = { width: 1200, height: 306 };
  expect(fitScale('auto', landscape, room)).toBe(0.5);
  expect(fitScale('page', landscape, room)).toBe(0.5);
  expect(fitScale('actual', landscape, room)).toBe(1);
});

test('zoom steps move to the next preset from the percentage on screen', () => {
  expect(shownZoom({ zoom: 100 }, 1.18)).toBe(118);
  expect(steppedZoom(118, 1)).toBe(125);
  expect(steppedZoom(118, -1)).toBe(100);
  expect(steppedZoom(125, 1)).toBe(150);
  expect(steppedZoom(400, 1)).toBe(400);
  expect(steppedZoom(40, -1)).toBe(25);
  // A fit beyond the presets never steps backwards.
  expect(steppedZoom(460, 1)).toBe(460);
  expect(steppedZoom(460, -1)).toBe(400);
  expect(steppedZoom(18, -1)).toBe(18);
  expect(steppedZoom(18, 1)).toBe(50);
});

test('each file kind offers only the fit modes that apply to it', () => {
  expect(fitOptions('pdf').map((option) => option.label)).toEqual([
    'Automatic',
    'Fit width',
    'Fit page',
  ]);
  expect(fitOptions('docx').map((option) => option.label)).toEqual(['Automatic', 'Fit width']);
  expect(fitOptions('image').map((option) => option.label)).toEqual(['Fit image']);
  expect(fitOptions('markdown')).toEqual([]);
});
