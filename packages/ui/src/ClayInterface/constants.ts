import type { View } from '@/navigation.ts';

/** The four places a job search lives in; everything else sits under More. */
export const primaryViews = [
  { id: 'board', label: 'Board', path: '/' },
  { id: 'inbox', label: 'Decisions', path: '/inbox' },
  { id: 'crew', label: 'Crew', path: '/crew' },
  { id: 'profile', label: 'Profile', path: '/profile' },
] as const satisfies readonly { id: View; label: string; path: string }[];

export const secondaryViews = [
  'queue',
  'chat',
  'skills',
  'routines',
  'insights',
  'activity',
] as const satisfies readonly View[];
