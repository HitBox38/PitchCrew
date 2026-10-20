import type { View } from '@/navigation.ts';
import {
  Activity,
  ListOrdered,
  BookOpen,
  CalendarClock,
  FileUser,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  Settings,
  Users,
} from 'lucide-react';

export const viewIcons = {
  board: LayoutDashboard,
  queue: ListOrdered,
  crew: Users,
  chat: MessageSquare,
  inbox: Inbox,
  profile: FileUser,
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
  inbox: 'Inbox',
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
