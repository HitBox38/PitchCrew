import type { ChatReference, Role, Skill } from '@pitchcrew/core';
export type ReferenceCatalog = { roles: Role[]; skills: Skill[] };
export type ReferenceValue = Omit<ChatReference, 'start' | 'end'>;
