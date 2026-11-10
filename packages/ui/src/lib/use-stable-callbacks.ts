import { useLayoutEffect, useRef, useState } from 'react';

type Callbacks = Record<string, (...args: never[]) => unknown>;

/**
 * Functions that keep their identity but always call the latest ones passed in, so handing a
 * memoized child a new closure does not render it again. For events: they call what the last
 * committed render passed, so they are not for use while rendering.
 */
export const useStableCallbacks = <T extends Callbacks>(callbacks: T): T => {
  const latest = useRef(callbacks);
  useLayoutEffect(() => {
    latest.current = callbacks;
  });
  const [stable] = useState(
    () =>
      Object.fromEntries(
        Object.keys(callbacks).map((key) => [
          key,
          (...args: never[]) => latest.current[key](...args),
        ]),
      ) as T,
  );
  return stable;
};
