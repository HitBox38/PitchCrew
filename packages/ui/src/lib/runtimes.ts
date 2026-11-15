import type { RuntimeId, RuntimeInfo } from '@pitchcrew/core';

/**
 * Whether a role's runtime can run isolated application work. A runtime missing from this
 * workspace (Demo in production) is left to the availability check that follows.
 */
export const isolatesApplications = (runtimes: readonly RuntimeInfo[], id: RuntimeId): boolean => {
  const runtime = runtimes.find((entry) => entry.id === id);
  return !runtime || runtime.applicationIsolation === true;
};

// Stored roles can outlive a runtime entry (notably Demo in production).
export const resolveRuntime = (runtimes: readonly RuntimeInfo[], id: RuntimeId): RuntimeInfo => {
  return (
    runtimes.find((runtime) => runtime.id === id) ?? {
      id,
      available: false,
      version: '',
      detail: 'This runtime is not available in this workspace.',
      models: [],
      modelSource: 'none',
      modelDetail:
        id === 'demo'
          ? 'Demo is only available in development. Choose a real runtime for this agent.'
          : 'This runtime is not available in this workspace. Choose another runtime.',
    }
  );
};
