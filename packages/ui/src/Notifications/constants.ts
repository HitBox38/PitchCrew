import {
  BookOpenCheck,
  CircleHelp,
  FileCheck2,
  MessageCircle,
  MousePointer2,
  Settings2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { NotificationContext } from './types.ts';

export const notificationPresentation: Record<
  NotificationContext,
  { icon: LucideIcon; action: string }
> = {
  message: { icon: MessageCircle, action: 'Open chat' },
  input: { icon: CircleHelp, action: 'Answer question' },
  packet_approval: { icon: FileCheck2, action: 'Review packet' },
  browser_approval: { icon: MousePointer2, action: 'Review browser action' },
  role_proposal: { icon: Settings2, action: 'Review role change' },
  skill_proposal: { icon: BookOpenCheck, action: 'Review skill' },
  instruction_update: { icon: Sparkles, action: 'Review update' },
};
