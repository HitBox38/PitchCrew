const owners = new Map<symbol, Set<string>>();
const listeners = new Set<() => void>();
let visible = new Set<string>();

const update = () => {
  const next = new Set([...owners.values()].flatMap((ids) => [...ids]));
  if (next.size === visible.size && [...next].every((id) => visible.has(id))) return;
  visible = next;
  listeners.forEach((listener) => listener());
};

export const setVisibleBrowserApprovals = (owner: symbol, ids: string[]) => {
  owners.set(owner, new Set(ids));
  update();
};
export const clearVisibleBrowserApprovals = (owner: symbol) => {
  owners.delete(owner);
  update();
};
export const getVisibleBrowserApprovals = (): ReadonlySet<string> => visible;
export const subscribeBrowserApprovalVisibility = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
