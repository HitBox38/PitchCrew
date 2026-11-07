import type { RuntimeAuthState, RuntimeSetupInfo } from '@pitchcrew/core';

export const authInProgress = (auth?: RuntimeAuthState) =>
  !!auth && ['starting', 'waiting', 'verifying'].includes(auth.stage);
export const installInProgress = (setup?: RuntimeSetupInfo) =>
  !!setup?.operation && !setup.operation.finishedAt;
