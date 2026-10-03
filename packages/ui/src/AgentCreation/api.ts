import { api } from '@/api.ts';
import type { Role } from '@pitchcrew/core';
import type { CreationDraft } from './types.ts';
import { creationInput } from './helpers.ts';

export function createAgent(draft: CreationDraft): Promise<Role> {
  return api<Role>('/roles', 'POST', creationInput(draft));
}
