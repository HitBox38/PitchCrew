import type { RuntimeId, RuntimeInfo } from '@pitchcrew/core';

// Stored roles can outlive a runtime entry (notably Demo in production).
export function resolveRuntime(runtimes: readonly RuntimeInfo[], id: RuntimeId): RuntimeInfo {
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
}
