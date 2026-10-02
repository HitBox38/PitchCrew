import type { View } from '@/navigation.ts';
import {
  Activity,
  BookOpen,
  FileUser,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Monitor,
  Moon,
  Sun,
  Users,
} from 'lucide-react';

export const viewIcons = {
  board: LayoutDashboard,
  crew: Users,
  chat: MessageSquare,
  inbox: Inbox,
  profile: FileUser,
  skills: BookOpen,
  activity: Activity,
};

export const viewTitles: Record<View, string> = {
  board: 'Board',
  crew: 'Crew',
  chat: 'Chat',
  inbox: 'Inbox',
  profile: 'Profile',
  skills: 'Skills',
  activity: 'Activity',
};

export const themeOptions = [
  { id: 'system', label: 'Match system', icon: Monitor },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
] as const;
