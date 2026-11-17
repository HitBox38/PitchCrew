import type { ActivityToolKind } from '@pitchcrew/core';
import {
  Brain,
  Eye,
  Globe,
  ListChecks,
  ListTodo,
  MessageCircle,
  MousePointerClick,
  Plug,
  Search,
  SquarePen,
  SquareTerminal,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export const outcomes = {
  running: 'In progress',
  completed: 'Finished',
  failed: 'Tool failed',
  interrupted: 'Outcome unavailable',
};
export const activityPresentation = {
  running: { status: 'running' },
  failed: { status: 'error' },
  interrupted: { status: 'pending' },
  completed: { status: undefined },
} as const;
export const turnPresentation = {
  running: { label: 'Working…' },
  failed: { label: 'Failed' },
  cancelled: { label: 'Stopped' },
  waiting: { label: 'Waiting for you' },
  completed: { label: 'Completed' },
} as const;
/**
 * Kinds whose targets are literal input when a runtime's own tool produced them: a command line,
 * a path, a search pattern or a URL. Crew steps reuse these kinds for plain words.
 */
export const codeTargetKinds: ReadonlySet<ActivityToolKind> = new Set([
  'command',
  'read',
  'edit',
  'search',
  'fetch',
]);
/** A step's kind as a quiet glyph beside its outcome bead; the bead still carries the outcome. */
export const stepIcons: Readonly<Record<ActivityToolKind | 'thinking', LucideIcon>> = {
  thinking: Brain,
  command: SquareTerminal,
  read: Eye,
  edit: SquarePen,
  search: Search,
  fetch: Globe,
  web_search: Globe,
  mcp: Plug,
  agent: Users,
  todo: ListTodo,
  browser: MousePointerClick,
  ask: MessageCircle,
  check: ListChecks,
  other: Wrench,
};
