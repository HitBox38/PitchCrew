export interface BrowserControlLease {
  roleId: string;
  threadId: string;
  id: string;
  /**
   * Taken by browsing while the agent was idle rather than by Take control. The panel hands an
   * implicit lease back when an agent run starts using this browser.
   */
  implicit?: boolean;
}

interface BrowserControlLeaseSnapshot {
  leases: Readonly<Record<string, BrowserControlLease>>;
  errors: Readonly<Record<string, string>>;
}

/**
 * Whether a panel should return control it took implicitly: an agent run is using the browser,
 * no page command is still in flight, and this lease has not already been handed back.
 */
export const shouldHandBack = (state: {
  runId: string | null;
  leaseId?: string;
  implicit: boolean;
  working: boolean;
  handedBack?: string;
}) =>
  !!state.runId &&
  !!state.leaseId &&
  state.implicit &&
  !state.working &&
  state.handedBack !== state.leaseId;

export const browserControlScopeKey = (roleId: string, threadId: string, cardId?: string | null) =>
  cardId ? `${roleId}:job:${cardId}` : `${roleId}:conversation:${threadId}`;

/** Renderer-session control survives route unmounts; the daemon remains the lease authority. */
export const createBrowserControlLeases = (
  renew: (lease: BrowserControlLease) => Promise<unknown>,
  /** Returns an implicit lease once renewal reports an agent run, even with no panel mounted. */
  handBack?: (lease: BrowserControlLease) => Promise<unknown>,
) => {
  let snapshot: BrowserControlLeaseSnapshot = { leases: {}, errors: {} };
  const listeners = new Set<() => void>();
  // Scopes with a mounted panel: that panel hands back after its in-flight commands finish.
  const mounted = new Map<string, number>();
  const pending = new Map<string, { id: string }>();
  const deadlines = new Map<string, number>();
  let renewAt = Date.now() + 20_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  const publish = (next: BrowserControlLeaseSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const reconcileTimer = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!closed && Object.keys(snapshot.leases).length) {
      const waitMs = Math.max(0, Math.min(renewAt, ...deadlines.values()) - Date.now());
      timer = setTimeout(() => {
        const now = Date.now();
        for (const [key, lease] of Object.entries(snapshot.leases)) {
          if (now >= deadlines.get(key)!) {
            const leases = { ...snapshot.leases };
            delete leases[key];
            deadlines.delete(key);
            publish({
              leases,
              errors: {
                ...snapshot.errors,
                [key]: 'Manual control expired. Take control again.',
              },
            });
            continue;
          }
          if (now < renewAt) continue;
          if (pending.get(key)?.id === lease.id) continue;
          const request = { id: lease.id };
          const startedAt = Date.now();
          pending.set(key, request);
          void Promise.resolve()
            .then(() => renew(lease))
            .then(async (result) => {
              if (closed || snapshot.leases[key]?.id !== lease.id) return;
              deadlines.set(key, startedAt + 45_000);
              if (snapshot.errors[key]) {
                const errors = { ...snapshot.errors };
                delete errors[key];
                publish({ ...snapshot, errors });
              }
              reconcileTimer();
              if (
                !handBack ||
                !lease.implicit ||
                mounted.get(key) ||
                !(result as { agentRun?: boolean } | undefined)?.agentRun
              )
                return;
              // Re-read the live lease: Keep control may have made it explicit meanwhile.
              const live = snapshot.leases[key];
              if (closed || live?.id !== lease.id || !live.implicit) return;
              // Keep the token unless the daemon confirmed the release; renewal retries.
              const released = await handBack(lease).then(
                () => true,
                () => false,
              );
              if (!released || closed || snapshot.leases[key]?.id !== lease.id) return;
              const leases = { ...snapshot.leases };
              delete leases[key];
              deadlines.delete(key);
              publish({ ...snapshot, leases });
              reconcileTimer();
            })
            .catch((cause: unknown) => {
              if (closed || snapshot.leases[key]?.id !== lease.id) return;
              const leases = { ...snapshot.leases };
              // Ambiguous renewals retain the token only in its acknowledged window.
              const ambiguous =
                cause instanceof Error &&
                ['AbortError', 'TimeoutError', 'TypeError'].includes(cause.name);
              if (!ambiguous || Date.now() >= deadlines.get(key)!) {
                delete leases[key];
                deadlines.delete(key);
              }
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
        if (now >= renewAt) renewAt = now + 20_000;
        reconcileTimer();
      }, waitMs);
    }
  };
  return {
    read: () => snapshot,
    /** Marks a panel mounted for a scope; returns its unmount. */
    attach: (key: string) => {
      mounted.set(key, (mounted.get(key) ?? 0) + 1);
      return () => {
        const count = (mounted.get(key) ?? 1) - 1;
        if (count > 0) mounted.set(key, count);
        else mounted.delete(key);
      };
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    remember: (key: string, lease: BrowserControlLease, acquiredAt = Date.now()) => {
      if (closed) return;
      if (!Object.keys(snapshot.leases).length) renewAt = Date.now() + 20_000;
      // Keep control changes metadata on the same token; only server acknowledgements
      // establish a new deadline or clear a renewal error.
      const existing = snapshot.leases[key]?.id === lease.id;
      if (!existing) deadlines.set(key, acquiredAt + 45_000);
      const errors = { ...snapshot.errors };
      if (!existing) delete errors[key];
      publish({ leases: { ...snapshot.leases, [key]: { ...lease } }, errors });
      reconcileTimer();
    },
    forget: (key: string, id: string | undefined) => {
      if (closed || snapshot.leases[key]?.id !== id) return;
      const leases = { ...snapshot.leases };
      const errors = { ...snapshot.errors };
      delete leases[key];
      delete errors[key];
      deadlines.delete(key);
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
      clearTimeout(timer);
      timer = undefined;
      pending.clear();
      deadlines.clear();
      publish({ leases: {}, errors: {} });
      listeners.clear();
    },
  };
};
