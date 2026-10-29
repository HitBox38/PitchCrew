export interface BrowserControlLease {
  roleId: string;
  threadId: string;
  id: string;
}

interface BrowserControlLeaseSnapshot {
  leases: Readonly<Record<string, BrowserControlLease>>;
  errors: Readonly<Record<string, string>>;
}

export const browserControlScopeKey = (roleId: string, threadId: string, cardId?: string | null) =>
  cardId ? `${roleId}:job:${cardId}` : `${roleId}:conversation:${threadId}`;

/** Renderer-session control survives route unmounts; the daemon remains the lease authority. */
export const createBrowserControlLeases = (
  renew: (lease: BrowserControlLease) => Promise<unknown>,
) => {
  let snapshot: BrowserControlLeaseSnapshot = { leases: {}, errors: {} };
  const listeners = new Set<() => void>();
  const pending = new Map<string, { id: string }>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const publish = (next: BrowserControlLeaseSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const reconcileTimer = () => {
    if (!closed && Object.keys(snapshot.leases).length) {
      timer ??= setInterval(() => {
        for (const [key, lease] of Object.entries(snapshot.leases)) {
          if (pending.get(key)?.id === lease.id) continue;
          const request = { id: lease.id };
          pending.set(key, request);
          void Promise.resolve()
            .then(() => renew(lease))
            .catch((cause: unknown) => {
              if (closed || snapshot.leases[key]?.id !== lease.id) return;
              const leases = { ...snapshot.leases };
              delete leases[key];
              publish({
                leases,
                errors: {
                  ...snapshot.errors,
                  [key]:
                    cause instanceof Error
                      ? cause.message
                      : 'Browser control could not be renewed.',
                },
              });
              reconcileTimer();
            })
            .finally(() => {
              if (pending.get(key) === request) pending.delete(key);
            });
        }
      }, 20_000);
    } else if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
  return {
    read: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    remember: (key: string, lease: BrowserControlLease) => {
      if (closed) return;
      const errors = { ...snapshot.errors };
      delete errors[key];
      publish({ leases: { ...snapshot.leases, [key]: { ...lease } }, errors });
      reconcileTimer();
    },
    forget: (key: string, id: string | undefined) => {
      if (closed || snapshot.leases[key]?.id !== id) return;
      const leases = { ...snapshot.leases };
      const errors = { ...snapshot.errors };
      delete leases[key];
      delete errors[key];
      publish({ leases, errors });
      reconcileTimer();
    },
    clearError: (key: string) => {
      if (closed || !snapshot.errors[key]) return;
      const errors = { ...snapshot.errors };
      delete errors[key];
      publish({ ...snapshot, errors });
    },
    close: () => {
      closed = true;
      if (timer) clearInterval(timer);
      timer = undefined;
      pending.clear();
      publish({ leases: {}, errors: {} });
      listeners.clear();
    },
  };
};
