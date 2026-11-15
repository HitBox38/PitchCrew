import type { ConversationMenuActions } from '@/ConversationNavigation/components/ConversationMenu.tsx';
import type { ConversationNavigationRow } from '@/ConversationNavigation/types.ts';
import type { SidebarJob } from './jobs.ts';

export type ClayJobRowProps = {
  job: SidebarJob;
  rows: ConversationNavigationRow[];
  open: boolean;
  setJobOpen: (id: string, open: boolean) => void;
  onOpenCard: (id: string) => void;
  thread?: string;
  now: number;
  closeMobile: () => void;
  actions: ConversationMenuActions;
  working: boolean;
};
