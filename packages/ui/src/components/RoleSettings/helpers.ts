import type { Role } from '@pitchcrew/core';
import { workflowSeat } from '@pitchcrew/core/states';
import { capabilityDefaults } from '@/agent-capabilities.ts';

export const roleSettingsDirty = (
  role: Role,
  draft: {
    id: string;
    name: string;
    description: string;
    workflow: Role['workflow'];
    runtime: Role['runtime'];
    model: string;
    reasoning: Role['reasoning'];
    enabled: boolean;
    browserMode: Role['browserMode'];
    instructions: string;
    capabilities: typeof capabilityDefaults;
  },
) =>
  draft.id !== role.id ||
  draft.name !== role.name ||
  draft.description !== role.description ||
  draft.workflow !== workflowSeat(role) ||
  draft.runtime !== role.runtime ||
  draft.model !== role.model ||
  draft.reasoning !== (role.reasoning ?? null) ||
  draft.enabled !== role.enabled ||
  draft.browserMode !== (role.browserMode ?? 'supervised') ||
  draft.instructions !== role.instructions ||
  JSON.stringify(draft.capabilities) !==
    JSON.stringify({ ...capabilityDefaults, ...role.capabilities });
