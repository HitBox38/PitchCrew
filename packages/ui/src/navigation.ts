import type { RoleId } from '@pitchcrew/core';

export const viewPaths = {
  board: '/',
  crew: '/crew',
  chat: '/chat',
  inbox: '/inbox',
  profile: '/profile',
  skills: '/skills',
  activity: '/activity',
} as const;
export type View = keyof typeof viewPaths;
export type ChatThread = RoleId | 'crew';
export type SkillFilter = RoleId | 'all' | 'shared';

export function isChatThread(value: string): value is ChatThread {
  return ['scout', 'writer', 'reviewer', 'crew'].includes(value);
}

export function validateSkillSearch(search: Record<string, unknown>): { filter?: SkillFilter } {
  const filter = search.filter;
  return typeof filter === 'string' && ['scout', 'writer', 'reviewer', 'shared'].includes(filter)
    ? { filter: filter as SkillFilter }
    : { filter: undefined };
}
