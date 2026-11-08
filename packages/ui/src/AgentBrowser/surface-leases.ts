/**
 * One native page can be claimed by several mounted slots while the panel moves between the
 * split pane, the modal sheet and the expanded dialog. Those slots live in different React
 * subtrees, so an outgoing slot can unmount after the incoming one mounted. Following T3's slot
 * leases, the newest claimant presents the page; a slot that lost ownership can neither move nor
 * hide it, and releasing the top lease hands presentation back to the previous claimant.
 */
type Lease = { owner: symbol; present: () => void };

const leases = new Map<string, Lease[]>();

export const claimSurface = (id: string, present: () => void, hide: () => void) => {
  const owner = Symbol(id);
  const stack = leases.get(id) ?? [];
  stack.push({ owner, present });
  leases.set(id, stack);
  return {
    owns: () => leases.get(id)?.at(-1)?.owner === owner,
    release: () => {
      const current = leases.get(id);
      if (!current) return;
      const index = current.findIndex((lease) => lease.owner === owner);
      if (index < 0) return;
      const wasTop = index === current.length - 1;
      current.splice(index, 1);
      if (!current.length) {
        leases.delete(id);
        hide();
      } else if (wasTop) current.at(-1)!.present();
    },
  };
};

/** Test seam: forget every lease. */
export const resetSurfaceLeases = () => leases.clear();
