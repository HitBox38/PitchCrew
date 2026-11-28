import {
  defaultCapabilities,
  type Role,
  type RuntimeId,
  type RuntimeConfiguration,
} from '@pitchcrew/core';
import { defaultRoles } from './default-roles.ts';
import type { BoardContext } from './types.ts';

/** Older Documenter rows predate the save grant. No stored choice means the default: it can save. */
const enableDocumenterSaving = (context: BoardContext) => {
  const documenter = context.list<Role>('role').find((role) => role.id === 'documenter');
  if (!documenter || documenter.retiredAt || documenter.capabilities?.editProfile != null) return;
  const role: Role = {
    ...documenter,
    capabilities: { ...defaultCapabilities, ...documenter.capabilities, editProfile: true },
  };
  context.record('role', role, 'system', 'Enabled profile saving for Documenter');
};

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
    enableDocumenterSaving(context);
  })();
};
