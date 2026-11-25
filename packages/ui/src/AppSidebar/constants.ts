import type { View } from '@/navigation.ts';
import {
  Activity,
  ListOrdered,
  BookOpen,
  CalendarClock,
  House,
  Inbox,
  IdCard,
  SquareKanban,
  Lightbulb,
  MessageSquare,
  Settings,
  Users,
} from 'lucide-react';

export const viewIcons = {
  home: House,
  pipeline: SquareKanban,
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
  home: 'Home',
  pipeline: 'Pipeline',
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

/** Go to… lists these after Home and Pipeline, then Settings, which the app bar keeps. */
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
  'home',
  'pipeline',
  'crew',
  'profile',
] as const satisfies readonly View[];

/** Pages reached from the sidebar's More menu; the row names whichever one is open. */
export const moreViews = [
  'inbox',
  'queue',
  'skills',
  'routines',
  'insights',
  'activity',
] as const satisfies readonly View[];
