import { isRoleId } from '@pitchcrew/core/states';
import type { RoleId } from '@pitchcrew/core';

export const viewPaths = {
  board: '/',
  crew: '/crew',
  chat: '/chat',
  inbox: '/inbox',
  profile: '/profile',
  skills: '/skills',
  routines: '/routines',
  insights: '/insights',
  activity: '/activity',
  settings: '/settings',
} as const;
export type View = keyof typeof viewPaths;
export type ChatThread = RoleId | 'crew';
export type SkillFilter = RoleId | 'all' | 'shared';

export function isChatThread(value: string): value is ChatThread {
  return (
    value === 'crew' ||
    isRoleId(value) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export function validateSkillSearch(search: Record<string, unknown>): { filter?: SkillFilter } {
  const filter = search.filter;
  return typeof filter === 'string' && (filter === 'shared' || isRoleId(filter))
    ? { filter: filter as SkillFilter }
    : { filter: undefined };
}
