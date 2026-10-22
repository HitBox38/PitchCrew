import type { Approval, ProfileFile, ChatReference, Role, Skill } from '@pitchcrew/core';
export type ReferenceCatalog = {
  roles: Role[];
  skills: Skill[];
  profile?: ProfileFile[];
  approvals?: Approval[];
};
export type ReferenceValue = Omit<ChatReference, 'start' | 'end'>;
