import type { View } from '@/navigation.ts';
import {
  Activity,
  BookOpen,
  CalendarClock,
  FileUser,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
} from 'lucide-react';

export const viewIcons = {
  board: LayoutDashboard,
  crew: Users,
  chat: MessageSquare,
  inbox: Inbox,
  profile: FileUser,
  skills: BookOpen,
  routines: CalendarClock,
  activity: Activity,
  settings: Settings,
};

export const viewTitles: Record<View, string> = {
  board: 'Board',
  crew: 'Crew',
  chat: 'Chat',
  inbox: 'Inbox',
  profile: 'Profile',
  skills: 'Skills',
  routines: 'Routines',
  activity: 'Activity',
  settings: 'Settings',
};
