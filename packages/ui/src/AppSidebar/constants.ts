import type { View } from '@/navigation.ts';
import {
  Activity,
  ListOrdered,
  BookOpen,
  CalendarClock,
  Inbox,
  IdCard,
  SquareKanban,
  Lightbulb,
  MessageSquare,
  Settings,
  Users,
} from 'lucide-react';

export const viewIcons = {
  board: SquareKanban,
  queue: ListOrdered,
  crew: Users,
  chat: MessageSquare,
  inbox: Inbox,
  profile: IdCard,
  skills: BookOpen,
  routines: CalendarClock,
  insights: Lightbulb,
  activity: Activity,
  settings: Settings,
};

export const viewTitles: Record<View, string> = {
  board: 'Board',
  queue: 'Queue',
  crew: 'Crew',
  chat: 'Chat',
  inbox: 'Decisions',
  profile: 'Profile',
  skills: 'Skills',
  routines: 'Routines',
  insights: 'Insights',
  activity: 'Activity',
  settings: 'Settings',
};

/** Sidebar order below Board; Settings stays pinned in the footer. */
export const workspaceViews = [
  'queue',
  'chat',
  'crew',
  'skills',
  'routines',
  'insights',
  'inbox',
  'profile',
  'activity',
] as const satisfies readonly View[];

/** The four primary places, in sidebar order, with ⌘/Ctrl+1–4. */
export const primaryShortcutViews = [
  'board',
  'inbox',
  'crew',
  'profile',
] as const satisfies readonly View[];

/** Pages reached from the sidebar's More menu; the row names whichever one is open. */
export const moreViews = [
  'queue',
  'skills',
  'routines',
  'insights',
  'activity',
] as const satisfies readonly View[];
