import { type Role, type RuntimeId, type RuntimeConfiguration } from '@pitchcrew/core';
import { defaultRoles } from './default-roles.ts';
import type { BoardContext } from './types.ts';

export const seedRoles = (
  context: BoardContext,
  runtime: RuntimeId = 'demo',
  enabled = true,
  configurations: ReadonlyMap<string, RuntimeConfiguration> = new Map(),
): void => {
  context.db.transaction(() => {
    const existing = context.list<Role>('role');
    const missing = defaultRoles(runtime, enabled)
      .filter((role) => !existing.some((saved) => saved.id === role.id))
      .slice(0, Math.max(0, 50 - existing.length));
    for (const role of missing) {
      const selected = configurations.get(role.id);
      context.record(
        'role',
        {
          ...role,
          ...(selected
            ? { runtime: selected.runtime, model: selected.model, reasoning: selected.reasoning }
            : {}),
        },
        'system',
        `Initialized ${role.name}`,
      );
    }
  })();
};
