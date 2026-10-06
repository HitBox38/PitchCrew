import type { AppBuild, AppUpdateInfo } from '@pitchcrew/core';
import { readAppBuild } from './build.ts';
import { checkGitHubRelease } from './github.ts';

export interface AppUpdateOptions {
  enabled: boolean;
  automatic: boolean;
  current?: AppBuild;
  fetcher?: typeof fetch;
  now?: () => number;
}

export function createAppUpdateChecker(options?: AppUpdateOptions) {
  const build = options?.current ? Promise.resolve(options.current) : readAppBuild();
  const now = options?.now ?? Date.now;
  const shutdown = new AbortController();
  let result: AppUpdateInfo | null = null;
  let pending: Promise<AppUpdateInfo> | null = null;
  const info = async (): Promise<AppUpdateInfo> =>
    result ?? {
      current: await build,
      automatic: options?.enabled === true && options.automatic,
      status: options?.enabled ? 'idle' : 'disabled',
      checkedAt: null,
      latest: null,
      message: options?.enabled
        ? 'Check for a newer Pitchcrew build.'
        : 'Update checks are disabled in this installation.',
    };
  const check = async (manual = false): Promise<AppUpdateInfo> => {
    if (!options?.enabled) return info();
    if (pending) return pending;
    const age = result?.checkedAt ? now() - Date.parse(result.checkedAt) : Infinity;
    if (age < (manual ? 60_000 : 3_600_000)) return info();
    pending = (async () => {
      const current = await build;
      const base = {
        current,
        automatic: options.automatic,
        checkedAt: new Date(now()).toISOString(),
      };
      try {
        const update = await checkGitHubRelease(
          current.commit,
          options.fetcher ?? fetch,
          AbortSignal.any([shutdown.signal, AbortSignal.timeout(10_000)]),
        );
        result = {
          ...base,
          ...update,
          message:
            update.status === 'available'
              ? 'A newer Pitchcrew build is available.'
              : update.status === 'current'
                ? 'No newer published build is available.'
                : 'Could not compare this build with the latest release. You can view the release below.',
        };
      } catch {
        result = {
          ...base,
          status: 'error',
          latest: null,
          message: 'Could not check for updates. Check your connection and try again later.',
        };
      }
      return result;
    })();
    try {
      return await pending;
    } finally {
      pending = null;
    }
  };
  return { info, check, close: () => shutdown.abort() };
}
