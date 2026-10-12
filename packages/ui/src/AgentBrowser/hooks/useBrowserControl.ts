import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrowserInput } from '@pitchcrew/core';
import { browserCommand, browserInput } from '../api.ts';

export function useBrowserControl(roleId: string, threadId: string) {
  const [leases, setLeases] = useState<
    Record<string, { roleId: string; threadId: string; id: string }>
  >({});
  const key = roleId;
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const queue = useRef(Promise.resolve());
  const leaseId = leases[key]?.id;
  const forget = (target = key) =>
    setLeases((current) => {
      const next = { ...current };
      delete next[target];
      return next;
    });
  const command = async (operation: () => Promise<unknown>) => {
    setWorking(true);
    setError('');
    try {
      await operation();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Browser action failed.');
    } finally {
      setWorking(false);
    }
  };
  const take = () =>
    command(async () => {
      const result = await browserCommand<{ leaseId: string }>(roleId, threadId, 'control', {
        operation: 'take',
      });
      setLeases((current) => ({ ...current, [key]: { roleId, threadId, id: result.leaseId } }));
    });
  const release = () =>
    command(async () => {
      await queue.current;
      await browserCommand(roleId, threadId, 'control', { operation: 'release', leaseId });
      forget();
    });
  useEffect(() => {
    if (!Object.keys(leases).length) return;
    const timer = setInterval(() => {
      for (const [target, lease] of Object.entries(leases)) {
        void browserCommand(lease.roleId, lease.threadId, 'control', {
          operation: 'renew',
          leaseId: lease.id,
        }).catch((error) => {
          setError(error.message);
          setLeases((current) => {
            const next = { ...current };
            delete next[target];
            return next;
          });
        });
      }
    }, 20_000);
    return () => clearInterval(timer);
  }, [leases]);
  const input = useCallback(
    (value: BrowserInput) => {
      if (!leaseId) return;
      queue.current = queue.current
        .then(() => browserInput(roleId, threadId, leaseId, value))
        .then(() => {})
        .catch((error) => setError(error.message));
    },
    [leaseId, roleId, threadId],
  );
  return { leaseId, error, working, take, release, input, command, forget };
}
