const owners = new Map<symbol, string>();
const listeners = new Set<() => void>();
let visible = new Set<string>();

const update = () => {
  const next = new Set(owners.values());
  if (next.size === visible.size && [...next].every((id) => visible.has(id))) return;
  visible = next;
  listeners.forEach((listener) => listener());
};

/** Exact existing notification IDs, not question read/answer state. */
export const setVisibleQuestionToast = (owner: symbol, messageId: string | undefined) => {
  if (messageId) owners.set(owner, `message:${messageId}`);
  else owners.delete(owner);
  update();
};
export const clearVisibleQuestionToast = (owner: symbol) => {
  owners.delete(owner);
  update();
};
export const getVisibleQuestionToasts = (): ReadonlySet<string> => visible;
export const subscribeQuestionToastVisibility = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
