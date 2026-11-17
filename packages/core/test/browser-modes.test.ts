import { expect, it } from 'vitest';
import { browserModeSchema, conversationPatch, roleChanges, rolePatch } from '../src/index.ts';
import {
  browserModeActsAlone,
  browserModeLabels,
  browserModeOrder,
  browserModeShortLabels,
  browserModeSummaries,
  isBrowserAccessMode,
} from '../src/browser-modes.ts';

it('names every browser mode once, from most to least supervised', () => {
  expect([...browserModeOrder].sort()).toEqual([...browserModeSchema.options].sort());
  expect(browserModeOrder).toEqual(['supervised', 'autonomous', 'edits', 'auto', 'full']);
  for (const labels of [browserModeLabels, browserModeShortLabels, browserModeSummaries])
    expect(Object.keys(labels).sort()).toEqual([...browserModeSchema.options].sort());
  expect(browserModeOrder.map((mode) => browserModeLabels[mode])).toEqual([
    'Supervised',
    'Autonomous preparation',
    'Accept edits',
    'Auto',
    'Full access',
  ]);
});

it('tells which modes approve by action class and which act without asking', () => {
  expect(browserModeOrder.filter(isBrowserAccessMode)).toEqual(['edits', 'auto', 'full']);
  expect(browserModeOrder.filter(browserModeActsAlone)).toEqual([
    'autonomous',
    'edits',
    'auto',
    'full',
  ]);
  expect(isBrowserAccessMode(undefined)).toBe(false);
  expect(browserModeActsAlone(undefined)).toBe(false);
});

it('lets only the user choose a browser mode, never an agent proposal', () => {
  expect(rolePatch.shape.browserMode.parse('full')).toBe('full');
  expect(
    conversationPatch.parse({ configurations: { scout: { browserMode: 'auto' } } }).configurations
      ?.scout?.browserMode,
  ).toBe('auto');
  expect(rolePatch.shape.browserMode.safeParse('everything').success).toBe(false);
  // Agents propose instruction and capability changes only; a mode can never ride along.
  expect(roleChanges.safeParse({ browserMode: 'full' }).success).toBe(false);
  expect(
    roleChanges.safeParse({ instructions: 'Use the browser freely.', browserMode: 'full' }).success,
  ).toBe(false);
});
