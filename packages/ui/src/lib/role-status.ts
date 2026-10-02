import type { Role, Snapshot } from '@pitchcrew/core';
import { runtimeLabels } from './labels.ts';

export function getRoleStatus(role: Role, data: Snapshot) {
  if (!role.enabled) return 'Paused';
  const run = data.runs.find((run) => run.status === 'running' && run.roleId === role.id);
  if (!run) return runtimeLabels[role.runtime];
  const card = data.cards.find((card) => card.id === run.cardId);
  return card ? `Working on ${card.company}` : 'Working';
}
