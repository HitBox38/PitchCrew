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

const decisionKey = (value: unknown) =>
  typeof value === 'string' && /^[\w:-]{1,120}$/.test(value) ? value : undefined;

/** Decisions opens a specific waiting decision, or a past one in Inbox history. */
export const validateInboxSearch = (
  search: Record<string, unknown>,
): { decision?: string; view?: 'history'; entry?: string } => ({
  decision: decisionKey(search.decision),
  view: search.view === 'history' ? 'history' : undefined,
  entry: search.view === 'history' ? decisionKey(search.entry) : undefined,
});

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

/** Home opens one Needs you item from a link: its key, `<kind>:<record id>`. */
export const validateHomeSearch = (search: Record<string, unknown>): { item?: string } => ({
  item:
    typeof search.item === 'string' && /^[a-z-]+:[\w:.-]{1,200}$/.test(search.item)
      ? search.item
      : undefined,
});

/** Pipeline shows the board or the table, optionally on one saved view of the table. */
export const validatePipelineSearch = (
  search: Record<string, unknown>,
): { mode?: 'board' | 'table'; view?: string } => ({
  mode: search.mode === 'board' || search.mode === 'table' ? search.mode : undefined,
  view:
    typeof search.view === 'string' && /^[a-z-]{1,32}$/.test(search.view) ? search.view : undefined,
});

export const viewPaths = {
  home: '/',
  pipeline: '/pipeline',
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
