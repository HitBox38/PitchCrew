import {
  ChartNoAxesCombined,
  ClipboardList,
  Compass,
  NotebookPen,
  PenLine,
  Search,
  Send,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import type { Role } from './Pebble';

const icons = {
  scout: Search,
  writer: PenLine,
  reviewer: ShieldCheck,
  submitter: Send,
  tracker: ClipboardList,
  documenter: NotebookPen,
  'pipeline-coach': ChartNoAxesCombined,
  'career-coach': Compass,
  you: UserRound,
} as const;

export const RoleIcon = ({ agent, size = 18 }: { agent: Role; size?: number }) => {
  const Icon = icons[agent];
  return <Icon size={size} strokeWidth={2} aria-hidden="true" />;
};
