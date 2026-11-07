import type { RuntimeAuthState, RuntimeInfo } from '@pitchcrew/core';
import { authInProgress } from './helpers.ts';

export const initialSetupSection = (runtime: RuntimeInfo, signedIn: boolean) =>
  runtime.configurationError
    ? 'signin'
    : !runtime.available
      ? 'installation'
      : signedIn
        ? 'models'
        : 'signin';

export const runtimeSetupSections = (
  runtime: RuntimeInfo,
  auth: RuntimeAuthState | undefined,
  signedIn: boolean,
  installing: boolean,
) => {
  const signing = authInProgress(auth);
  const recovery = !!runtime.configurationError || !!auth?.configurationError;
  const installed = runtime.configurationError?.installationAvailable ?? runtime.available;
  const blocked = !installed || installing;
  const expired =
    auth?.expiresAt && auth.finishedAt && Date.parse(auth.finishedAt) >= Date.parse(auth.expiresAt);
  return [
    {
      id: 'installation',
      label: '1. Installation',
      status: installing ? 'Installing' : installed ? 'Ready' : 'Needs setup',
      tone: installing ? 'plum' : installed ? 'primary' : 'ochre',
    },
    {
      id: 'signin',
      label: '2. Sign-in',
      status: recovery
        ? 'Recover settings'
        : blocked
          ? 'Install first'
          : signing
            ? auth?.stage === 'waiting'
              ? 'Waiting'
              : 'Checking'
            : signedIn
              ? 'Signed in'
              : auth?.stage === 'failed'
                ? expired
                  ? 'Expired'
                  : 'Failed'
                : 'Needs check',
      tone: recovery
        ? 'ochre'
        : blocked
          ? ''
          : signing
            ? auth?.stage === 'waiting'
              ? 'ochre'
              : 'plum'
            : signedIn
              ? 'primary'
              : auth?.stage === 'failed'
                ? 'rose'
                : 'ochre',
    },
    {
      id: 'models',
      label: '3. Models',
      status: recovery
        ? 'Recover settings'
        : !runtime.available
          ? 'Install first'
          : runtime.modelSource === 'fallback'
            ? 'Built-in list'
            : runtime.modelSource === 'runtime'
              ? `${runtime.models.filter((model) => !('custom' in model)).length} native`
              : 'No list',
      tone: runtime.available && runtime.modelSource === 'runtime' ? 'primary' : '',
    },
  ];
};
