import { createElement, use, type ComponentType, type ReactElement } from 'react';

type PropsOf<C> = C extends ComponentType<infer P> ? P : never;

/**
 * A lazily imported page or panel that never reloads the window on its own.
 *
 * TanStack's `lazyRouteComponent` silently reloads once for a missing module, and a reload
 * discards unsent chat and brief drafts held in renderer memory. Here a failed import is thrown
 * to the nearest load-failure boundary, which offers an explicit, confirmed reload instead.
 *
 * `retryFailedLoads()` lets the next render call the importer again, unlike `React.lazy`, which
 * keeps a rejection forever. That helps only failures outside the browser's module map: Chromium
 * keeps a failed module graph for the life of the document, so a chunk or dependency that failed
 * to download needs a reload. The recovery screen therefore does not offer Try again for those.
 */
export type RetryableLazy<C> = ((props: PropsOf<C>) => ReactElement) & {
  preload: () => Promise<void>;
};

const failed = new Set<() => void>();

/** Clears every recorded load failure so the next render imports again; returns how many. */
export const retryFailedLoads = () => {
  const resets = [...failed];
  failed.clear();
  for (const reset of resets) reset();
  return resets.length;
};

export const retryableLazy = <M extends Record<K, ComponentType<never>>, K extends keyof M>(
  importer: () => Promise<M>,
  name: K,
): RetryableLazy<M[K]> => {
  let component: M[K] | undefined;
  let error: unknown;
  // One promise per attempt, kept after it settles. It never rejects: a failure is stored in
  // `error` and thrown at render. Once settled it carries React's fulfilled-thenable fields, so
  // `use()` reads it synchronously instead of suspending again.
  let attempt: Promise<void> | undefined;
  const reset = () => {
    error = undefined;
    attempt = undefined;
  };
  const load = () => {
    if (attempt) return attempt;
    const loading: Promise<void> = importer().then(
      (module) => {
        component = module[name];
      },
      (reason: unknown) => {
        error = reason ?? new Error('A part of Pitchcrew could not be loaded.');
        failed.add(reset);
      },
    );
    void loading.then(() => {
      Object.assign(loading, { status: 'fulfilled' as const, value: undefined });
    });
    attempt = loading;
    return loading;
  };
  // `use()` runs on every render, including the one after the import resolves. React warns when
  // a component that suspended on `use()` later finishes without calling it.
  const Lazy = (props: PropsOf<M[K]>) => {
    use(load());
    if (error !== undefined) throw error;
    return createElement(component as unknown as ComponentType<object>, props as object);
  };
  Lazy.preload = load;
  return Lazy;
};
