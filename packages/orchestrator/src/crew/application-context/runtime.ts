import { adapters } from '@pitchcrew/adapters';
import type { Role } from '@pitchcrew/core';

export const assertApplicationRuntime = (role: Role) => {
  if (!adapters[role.runtime].applicationIsolation)
    throw new Error(
      'This runtime does not support isolated application runs. Choose Codex, Claude Code or OpenCode, or prepare a brief manually.',
    );
};
