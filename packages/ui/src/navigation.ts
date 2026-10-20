import { isRoleId } from '@pitchcrew/core/states';
import type { RoleId } from '@pitchcrew/core';

export const isChatThread = (value: string): value is ChatThread => {
  return (
    value === 'crew' ||
    isRoleId(value) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
};

export const validateUpdateSearch = (
  search: Record<string, unknown>,
): {
  updates?: true;
  review?: string;
} => {
  return {
    updates: search.updates === true || search.updates === 'true' ? true : undefined,
    review:
      typeof search.review === 'string' && isRoleId(search.review) ? search.review : undefined,
  };
};

export const validateSkillSearch = (
  search: Record<string, unknown>,
): {
  filter?: SkillFilter;
  updates?: true;
  skill?: string;
  review?: true;
} => {
  const filter = search.filter;
  return {
    filter:
      typeof filter === 'string' && (filter === 'shared' || isRoleId(filter))
        ? (filter as SkillFilter)
        : undefined,
    updates: search.updates === true || search.updates === 'true' ? true : undefined,
    skill:
      typeof search.skill === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search.skill)
        ? search.skill
        : undefined,
    review: search.review === true || search.review === 'true' ? true : undefined,
  };
};

export const validateChatSearch = (search: Record<string, unknown>): { run?: string } => {
  return {
    run:
      typeof search.run === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(search.run)
        ? search.run
        : undefined,
  };
};

export const viewPaths = {
  board: '/',
  queue: '/queue',
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
