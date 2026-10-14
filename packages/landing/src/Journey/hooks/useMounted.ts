import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** True only after hydration, for content whose text depends on the visitor's clock or locale. */
export function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
