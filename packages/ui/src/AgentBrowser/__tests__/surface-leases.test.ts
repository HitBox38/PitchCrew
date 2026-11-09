import { afterEach, expect, it, vi } from 'vitest';
import { claimSurface, resetSurfaceLeases } from '../surface-leases.ts';

afterEach(() => resetSurfaceLeases());

it('lets the newest slot own a page and ignores a late release from the slot it replaced', () => {
  const hide = vi.fn();
  const split = claimSurface('page', vi.fn(), hide);
  const expanded = claimSurface('page', vi.fn(), hide);
  expect(split.owns()).toBe(false);
  expect(expanded.owns()).toBe(true);
  // The split pane's subtree unmounts after the expanded dialog mounted: no park in between.
  split.release();
  expect(hide).not.toHaveBeenCalled();
  expect(expanded.owns()).toBe(true);
  expanded.release();
  expect(hide).toHaveBeenCalledOnce();
});

it('hands presentation back to the previous slot when the newest one leaves', () => {
  const hide = vi.fn();
  const presentSplit = vi.fn();
  const split = claimSurface('page', presentSplit, hide);
  const sheet = claimSurface('page', vi.fn(), hide);
  sheet.release();
  expect(presentSplit).toHaveBeenCalledOnce();
  expect(split.owns()).toBe(true);
  expect(hide).not.toHaveBeenCalled();
  // Releasing twice is harmless.
  sheet.release();
  expect(presentSplit).toHaveBeenCalledOnce();
});

it('keeps leases for different pages independent', () => {
  const hide = vi.fn();
  const first = claimSurface('first', vi.fn(), hide);
  const second = claimSurface('second', vi.fn(), hide);
  expect(first.owns()).toBe(true);
  expect(second.owns()).toBe(true);
  first.release();
  expect(hide).toHaveBeenCalledOnce();
  expect(second.owns()).toBe(true);
});
