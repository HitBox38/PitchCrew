import { expect, it } from 'vitest';
import {
  clearVisibleBrowserApprovals,
  getVisibleBrowserApprovals,
  setVisibleBrowserApprovals,
  subscribeBrowserApprovalVisibility,
} from '../approval-visibility.ts';

it('tracks exact visible approvals before hosted chrome commits and releases each owner independently', () => {
  const first = Symbol('first panel');
  const second = Symbol('second panel');
  const changes: string[][] = [];
  const stop = subscribeBrowserApprovalVisibility(() => {
    changes.push([...getVisibleBrowserApprovals()]);
  });
  try {
    setVisibleBrowserApprovals(first, ['approval-one']);
    const initial = getVisibleBrowserApprovals();
    expect(initial.has('approval-one')).toBe(true);
    setVisibleBrowserApprovals(first, ['approval-one']);
    expect(getVisibleBrowserApprovals()).toBe(initial);
    setVisibleBrowserApprovals(second, ['approval-one', 'approval-two']);
    clearVisibleBrowserApprovals(first);
    expect([...getVisibleBrowserApprovals()]).toEqual(['approval-one', 'approval-two']);
    clearVisibleBrowserApprovals(second);
    expect(getVisibleBrowserApprovals().size).toBe(0);
    expect(changes).toEqual([['approval-one'], ['approval-one', 'approval-two'], []]);
  } finally {
    stop();
    clearVisibleBrowserApprovals(first);
    clearVisibleBrowserApprovals(second);
  }
});
