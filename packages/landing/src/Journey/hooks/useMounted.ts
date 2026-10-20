import { useSyncExternalStore } from 'react';

/** True only after hydration, for content whose text depends on the visitor's clock or locale. */
export const useMounted = () => {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
};

const subscribe = () => () => {};
