import type { RuntimeAuthentication, RuntimeInfo, RuntimeUpdateInfo, Run } from '@pitchcrew/core';

export const runtimeUpdateCount = (runtimes: RuntimeInfo[], updates: RuntimeUpdateInfo[] = []) => {
  const installed = new Set(
    runtimes
      .filter((runtime) => runtime.id !== 'demo' && (runtime.available || !!runtime.version))
      .map((runtime) => runtime.id),
  );
  return updates.filter((update) => installed.has(update.id) && update.status === 'available')
    .length;
};

/** Chip tones from the shared vocabulary; an empty tone is a neutral chip. */
export type RuntimeTone = '' | 'ochre' | 'plum' | 'primary';

export const runtimeStatus = (
  runtime: RuntimeInfo,
  update?: RuntimeUpdateInfo,
): { label: string; tone: RuntimeTone } => {
  if (runtime.id === 'demo') return { label: 'Scripted demo', tone: '' };
  if (!runtime.version) return { label: 'Not installed', tone: '' };
  if (!runtime.available) return { label: 'Incompatible version', tone: 'ochre' };
  if (update?.operation && !update.operation.finishedAt) return { label: 'Updating', tone: 'plum' };
  if (update?.status === 'available')
    return {
      label: `Update available${update.latestVersion ? `: ${update.latestVersion}` : ''}`,
      tone: 'primary',
    };
  if (update?.status === 'current') return { label: 'Up to date', tone: '' };
  if (update?.status === 'unknown') return { label: 'Update check unavailable', tone: '' };
  return { label: 'Compatible', tone: '' };
};

/** Sign-in is a separate fact: needed, confirmed for every checked model, or not checked. */
export const signInStatus = (
  runtime: RuntimeInfo,
  results: { result: RuntimeAuthentication }[],
): { label: string; tone: RuntimeTone } | null => {
  if (runtime.id === 'demo' || !runtime.version || !runtime.available) return null;
  if (results.some(({ result }) => result.status === 'missing'))
    return { label: 'Sign-in needed', tone: 'ochre' };
  if (results.length && results.every(({ result }) => result.status === 'authenticated'))
    return { label: 'Signed in', tone: '' };
  return { label: 'Sign-in not checked', tone: '' };
};

/** The most recent update check across runtimes, for the section heading. */
export const lastRuntimeCheck = (updates: RuntimeUpdateInfo[] = []) =>
  updates.reduce<string | null>(
    (latest, update) =>
      update.checkedAt && (!latest || update.checkedAt > latest) ? update.checkedAt : latest,
    null,
  );

/**
 * An unverifiable sign-in stops mattering once this runtime and model finish a run after the
 * check: that run proves the CLI is authenticated, so the warning would only mislead.
 */
export const authenticationNotice = (
  auth: RuntimeAuthentication | undefined,
  runs: Run[],
  runtime: string,
  model: string,
) => {
  if (!auth || auth.status === 'authenticated') return null;
  if (
    auth.status === 'unknown' &&
    runs.some(
      (run) =>
        run.status === 'completed' &&
        run.runtime === runtime &&
        (run.configuration?.role.model ?? model) === model &&
        !!run.finishedAt &&
        run.finishedAt >= auth.checkedAt,
    )
  )
    return null;
  return auth;
};
