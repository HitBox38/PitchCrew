import { useEffect, useSyncExternalStore } from 'react';
import { browserCommand } from '../api.ts';
import { createBrowserControlLeases } from '../control-leases.ts';

const leases = createBrowserControlLeases(
  (lease) =>
    browserCommand(
      lease.roleId,
      lease.threadId,
      'control',
      {
        operation: 'renew',
        leaseId: lease.id,
      },
      AbortSignal.timeout(10_000),
    ),
  (lease) =>
    browserCommand(lease.roleId, lease.threadId, 'control', {
      operation: 'release',
      leaseId: lease.id,
    }),
);

/** The scope's lease as stored now, for callers holding an older render's closure. */
export const readBrowserControlLease = (key: string) => leases.read().leases[key];

export const useBrowserControlLease = (key: string) => {
  const snapshot = useSyncExternalStore(leases.subscribe, leases.read);
  useEffect(() => leases.attach(key), [key]);
  return {
    lease: snapshot.leases[key],
    renewalError: snapshot.errors[key] ?? '',
    remember: leases.remember,
    forget: leases.forget,
    clearError: leases.clearError,
  };
};
