import {
  decodeEvent,
  defaultCapabilities,
  type Role,
  type RuntimeId,
  type RuntimeConfiguration,
} from '@pitchcrew/core';
import { defaultRoles } from './default-roles.ts';
import type { BoardContext } from './types.ts';

/**
 * Older Documenter rows predate the save grant. Settings saves stored the default off, so a
 * seeded role that was never actually granted saving gets it. An off after a real on stays off.
 */
const enableDocumenterSaving = (context: BoardContext) => {
  const documenter = context.list<Role>('role').find((role) => role.id === 'documenter');
  if (!documenter || documenter.retiredAt || documenter.capabilities?.editProfile === true) return;
  const rows = context.db
    .prepare(
      "SELECT json FROM events WHERE json_extract(json,'$.kind') = 'role' AND json_extract(json,'$.entityId') = ? ORDER BY id",
    )
    .all('documenter') as { json: string }[];
  const events = rows.map((row) => decodeEvent(row.json));
  if (events[0]?.actor !== 'system') return;
  let granted = false;
  for (const event of events) {
    const value = (event.data as Role).capabilities?.editProfile;
    if (granted && value === false) return;
    if (value === true) granted = true;
  }
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
