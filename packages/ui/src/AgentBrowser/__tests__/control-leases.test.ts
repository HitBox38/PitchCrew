import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  browserControlScopeKey,
  createBrowserControlLeases,
  type BrowserControlLease,
} from '../control-leases.ts';

const stores: ReturnType<typeof createBrowserControlLeases>[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  vi.useRealTimers();
});
const fixture = (renew: (lease: BrowserControlLease) => Promise<unknown>) => {
  const store = createBrowserControlLeases(renew);
  stores.push(store);
  return store;
};
const pending = () => {
  let resolve = (_value: unknown) => {};
  let reject = (_cause: Error) => {};
  const promise = new Promise<unknown>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const lease = { roleId: 'writer', threadId: 'conversation-a', id: 'private-controller-a' };
const key = browserControlScopeKey(lease.roleId, lease.threadId, null);

test('renews private control with no mounted view and stops after its final controller is forgotten', async () => {
  const renew = vi.fn(async (_lease: BrowserControlLease) => {});
  const store = fixture(renew);
  const observe = vi.fn();
  const unsubscribe = store.subscribe(observe);
  store.remember(key, lease);
  unsubscribe();
  await vi.advanceTimersByTimeAsync(20_000);
  expect(renew).toHaveBeenCalledExactlyOnceWith(lease);
  expect(store.read().leases[key]).toEqual(lease);
  expect(observe).toHaveBeenCalledTimes(1);
  store.forget(key, lease.id);
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(40_000);
  expect(renew).toHaveBeenCalledTimes(1);
});

test('shares a job controller between its conversations while other jobs, roles and standalone chats stay independent', async () => {
  const renew = vi.fn(async (_lease: BrowserControlLease) => {});
  const store = fixture(renew);
  const first = browserControlScopeKey('writer', 'conversation-a', 'job-a');
  const related = browserControlScopeKey('writer', 'conversation-b', 'job-a');
  const otherJob = browserControlScopeKey('writer', 'conversation-a', 'job-b');
  const standalone = browserControlScopeKey('writer', 'conversation-a', null);
  const otherRole = browserControlScopeKey('scout', 'conversation-a', 'job-a');
  expect(related).toBe(first);
  store.remember(first, lease);
  store.remember(otherJob, { ...lease, id: 'job-b-controller' });
  store.remember(standalone, { ...lease, id: 'standalone-controller' });
  store.remember(otherRole, { ...lease, roleId: 'scout', id: 'scout-controller' });
  expect(store.read().leases[related].id).toBe(lease.id);
  expect(Object.keys(store.read().leases)).toHaveLength(4);
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(20_000);
  expect(renew).toHaveBeenCalledTimes(4);
  store.forget(related, lease.id);
  expect(store.read().leases[first]).toBeUndefined();
  expect(Object.keys(store.read().leases)).toHaveLength(3);
});

test('ignores a late renewal failure after the user acquires a newer controller in the same scope', async () => {
  const old = pending();
  const renew = vi
    .fn<(lease: BrowserControlLease) => Promise<unknown>>()
    .mockReturnValueOnce(old.promise)
    .mockResolvedValue(undefined);
  const store = fixture(renew);
  store.remember(key, lease);
  await vi.advanceTimersByTimeAsync(20_000);
  const replacement = { ...lease, id: 'new-controller' };
  store.remember(key, replacement);
  old.reject(new Error('The previous controller expired.'));
  await vi.advanceTimersByTimeAsync(0);
  expect(store.read().leases[key]).toEqual(replacement);
  expect(store.read().errors[key]).toBeUndefined();
  await vi.advanceTimersByTimeAsync(20_000);
  expect(renew).toHaveBeenLastCalledWith(replacement);
});

test('does not overlap renewal of one token or let an old completion erase the newer in-flight renewal', async () => {
  const old = pending();
  const next = pending();
  const renew = vi
    .fn<(lease: BrowserControlLease) => Promise<unknown>>()
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(next.promise);
  const store = fixture(renew);
  store.remember(key, lease);
  await vi.advanceTimersByTimeAsync(40_000);
  expect(renew).toHaveBeenCalledTimes(1);
  store.remember(key, { ...lease, id: 'replacement-controller' });
  await vi.advanceTimersByTimeAsync(20_000);
  expect(renew).toHaveBeenCalledTimes(2);
  old.resolve(undefined);
  await vi.advanceTimersByTimeAsync(20_000);
  expect(renew).toHaveBeenCalledTimes(2);
  next.reject(new Error('The replacement controller expired.'));
  await vi.advanceTimersByTimeAsync(0);
  expect(store.read().leases[key]).toBeUndefined();
  expect(store.read().errors[key]).toBe('The replacement controller expired.');
  expect(vi.getTimerCount()).toBe(0);
});

test('retains a failed renewal error for the returning view without revoking another session', async () => {
  const store = fixture(async (current) => {
    if (current.roleId === 'writer') throw new Error('Fictional connection lost.');
  });
  const other = browserControlScopeKey('scout', 'conversation-b', null);
  store.remember(key, lease);
  store.remember(other, { roleId: 'scout', threadId: 'conversation-b', id: 'other-controller' });
  await vi.advanceTimersByTimeAsync(20_000);
  const returningView = vi.fn();
  store.subscribe(returningView);
  expect(store.read().errors[key]).toBe('Fictional connection lost.');
  expect(store.read().leases[key]).toBeUndefined();
  expect(store.read().leases[other].id).toBe('other-controller');
  expect(store.read().errors[other]).toBeUndefined();
  store.clearError(key);
  expect(returningView).toHaveBeenCalledTimes(1);
  expect(store.read().leases[other].id).toBe('other-controller');
});

test('a delayed release cannot forget a replacement controller', () => {
  const store = fixture(async () => {});
  store.remember(key, lease);
  store.remember(key, { ...lease, id: 'replacement-controller' });
  store.forget(key, lease.id);
  store.forget(key, undefined);
  expect(store.read().leases[key].id).toBe('replacement-controller');
  store.forget(key, 'replacement-controller');
  expect(store.read().leases[key]).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});
