import { useCallback, useRef, useState } from 'react';
import type { BrowserInput, BrowserViewport } from '@pitchcrew/core';
import { browserCommand, browserInput } from '../api.ts';
import { browserControlScopeKey } from '../control-leases.ts';
import { useBrowserControlLease } from './useBrowserControlLease.ts';

export const useBrowserControl = (
  roleId: string,
  threadId: string,
  refresh: () => Promise<void>,
  cardId?: string | null,
  /** No agent run is using this browser, so the user may browse without Take control first. */
  idle = false,
) => {
  const key = browserControlScopeKey(roleId, threadId, cardId);
  const leases = useBrowserControlLease(key);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [inputPending, setInputPending] = useState(0);
  const queue = useRef<Promise<void> | null>(null);
  const leaseId = leases.lease?.id;
  const forget = () => leases.forget(key, leaseId);
  const command = async (operation: () => Promise<unknown>, afterRefresh?: () => void) => {
    setWorking(true);
    setError('');
    leases.clearError(key);
    try {
      await operation();
      await refresh().catch(() => {});
      afterRefresh?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Browser action failed.');
    } finally {
      setWorking(false);
    }
  };
  const { remember } = leases;
  const acquire = useCallback(
    async (implicit: boolean) => {
      const result = await browserCommand<{ leaseId: string }>(roleId, threadId, 'control', {
        operation: 'take',
      });
      remember(key, { roleId, threadId, id: result.leaseId, implicit });
      return result.leaseId;
    },
    [key, remember, roleId, threadId],
  );
  const take = () => command(() => acquire(false));
  /** The current lease, or an implicit one while the agent is idle; undefined otherwise. */
  const ensure = useCallback(async () => {
    if (leaseId) return leaseId;
    if (!idle) return undefined;
    return acquire(true);
  }, [acquire, idle, leaseId]);
  const release = () =>
    command(
      async () => {
        await queue.current;
        await browserCommand(roleId, threadId, 'control', { operation: 'release', leaseId });
      },
      () => forget(),
    );
  const input = useCallback(
    (value: BrowserInput, lease = leaseId) => {
      if (!lease) return;
      setInputPending((count) => count + 1);
      queue.current = (queue.current ?? Promise.resolve())
        .then(() => browserInput(roleId, threadId, lease, value))
        .then(() => {})
        .catch((error) => setError(error.message))
        .finally(() => setInputPending((count) => count - 1));
    },
    [leaseId, roleId, threadId],
  );
  const resize = useCallback(
    (viewport: BrowserViewport, signal: AbortSignal) => {
      const result = (queue.current ?? Promise.resolve()).then(() =>
        browserCommand<{ applied: boolean }>(
          roleId,
          threadId,
          'viewport',
          { ...viewport, leaseId },
          signal,
        ),
      );
      queue.current = result.then(
        () => {},
        () => {},
      );
      return result;
    },
    [leaseId, roleId, threadId],
  );
  const open = () =>
    command(async () => {
      const result = await browserCommand<{ native?: boolean }>(roleId, threadId, 'open');
      // Opening is browsing: it leaves the lease implicit so a later agent run gets it back.
      if (result.native) await acquire(true);
    });
  return {
    leaseId,
    /** The user may operate page controls now (holding control, or the agent is idle). */
    available: !!leaseId || idle,
    implicit: !!leases.lease?.implicit,
    error: error || leases.renewalError,
    working,
    inputPending,
    open,
    take,
    ensure,
    release,
    input,
    resize,
    command,
    forget,
  };
};
