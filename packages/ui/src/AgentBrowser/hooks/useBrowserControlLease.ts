import { useSyncExternalStore } from 'react';
import { browserCommand } from '../api.ts';
import { createBrowserControlLeases } from '../control-leases.ts';

const leases = createBrowserControlLeases((lease) =>
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
);

export const useBrowserControlLease = (key: string) => {
  const snapshot = useSyncExternalStore(leases.subscribe, leases.read);
  return {
    lease: snapshot.leases[key],
    renewalError: snapshot.errors[key] ?? '',
    remember: leases.remember,
    forget: leases.forget,
    clearError: leases.clearError,
  };
};
