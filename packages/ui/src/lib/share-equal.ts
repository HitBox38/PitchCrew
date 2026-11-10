type Plain = Record<string, unknown>;
const plain = (value: unknown): value is Plain =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
const idOf = (value: unknown) =>
  plain(value) && typeof value.id === 'string' ? value.id : undefined;

/**
 * `next`, with every part equal to the matching part of `prev` replaced by `prev`'s, so data that
 * did not change keeps its identity across snapshot and stream updates and memoized views skip it.
 * Array items are matched by `id` when they have one (a new run at the front shifts the others),
 * otherwise by position.
 */
export const shareEqual = <T>(prev: unknown, next: T): T => {
  if (prev === next) return next;
  if (Array.isArray(prev) && Array.isArray(next)) {
    const byId = new Map(prev.flatMap((item) => (idOf(item) ? [[idOf(item), item]] : [])));
    let same = prev.length === next.length;
    const out = next.map((item, index) => {
      const id = idOf(item);
      const shared = shareEqual(id !== undefined ? byId.get(id) : prev[index], item);
      if (shared !== prev[index]) same = false;
      return shared;
    });
    return (same ? prev : out) as T;
  }
  if (plain(prev) && plain(next)) {
    const keys = Object.keys(next);
    let same = keys.length === Object.keys(prev).length;
    const out: Plain = {};
    for (const key of keys) {
      out[key] = shareEqual(prev[key], next[key]);
      if (out[key] !== prev[key] || !(key in prev)) same = false;
    }
    return (same ? prev : out) as T;
  }
  return next;
};

/**
 * Whether two values hold the same data: plain objects and arrays compared deeply, anything else
 * (functions included) by identity. As a `memo` comparison it lets a component skip rendering when
 * its props are rebuilt each render but unchanged; shared parts return at once.
 */
export const deepEqual = (a: unknown, b: unknown) => shareEqual(a, b) === a;
