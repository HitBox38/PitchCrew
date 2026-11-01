import {
  Activity,
  BookOpen,
  CalendarClock,
  IdCard,
  Inbox,
  Lightbulb,
  ListOrdered,
  MessageSquare,
  Settings,
  SquareKanban,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { View } from '@/navigation.ts';

/** Every page, in sidebar order; secondary pages are named as they appear under More. */
export const paletteViews: { id: View; title: string; context: string; icon: LucideIcon }[] = [
  { id: 'board', title: 'Board', context: 'Jobs by stage', icon: SquareKanban },
  { id: 'inbox', title: 'Decisions', context: 'Waiting for your decision', icon: Inbox },
  { id: 'crew', title: 'Crew', context: 'Agents and their work', icon: Users },
  { id: 'profile', title: 'Profile', context: 'Notes your crew can cite', icon: IdCard },
  { id: 'chat', title: 'Chat', context: 'Conversations', icon: MessageSquare },
  { id: 'queue', title: 'Queue', context: 'Running and waiting work', icon: ListOrdered },
  { id: 'skills', title: 'Skills', context: 'Instructions for agents', icon: BookOpen },
  { id: 'routines', title: 'Routines', context: 'Scheduled actions', icon: CalendarClock },
  { id: 'insights', title: 'Insights', context: 'Outcomes, tags and plans', icon: Lightbulb },
  { id: 'activity', title: 'Activity', context: 'Everything that happened', icon: Activity },
  { id: 'settings', title: 'Settings', context: 'Accounts, runtimes and data', icon: Settings },
];
