import type { CardState, JobProvider, RuntimeId } from '@pitchcrew/core';
import {
  ChartNoAxesCombined,
  ClipboardList,
  NotebookPen,
  PenLine,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react';

export const stateLabels: Record<CardState, string> = {
  lead: 'New lead',
  shortlisted: 'Shortlisted',
  drafting: 'Drafting',
  in_review: 'In review',
  changes_requested: 'Changes requested',
  agreed: 'Reviewed',
  awaiting_approval: 'Awaiting approval',
  submitted: 'Submitted',
  screening: 'Screening',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  ghosted: 'No response',
};

export const jobProviderLabels: Record<JobProvider, string> = {
  greenhouse: 'Greenhouse',
  ashby: 'Ashby',
  lever: 'Lever',
  comeet: 'Comeet',
  workable: 'Workable',
};

export const roleIcons = {
  scout: Search,
  writer: PenLine,
  reviewer: ShieldCheck,
  submitter: Send,
  tracker: ClipboardList,
  documenter: NotebookPen,
  'pipeline-coach': ChartNoAxesCombined,
};

export const runtimeLabels: Record<RuntimeId, string> = {
  demo: 'Demo',
  codex: 'Codex',
  'claude-code': 'Claude Code',
  'gemini-cli': 'Gemini CLI',
  opencode: 'OpenCode',
  'copilot-cli': 'GitHub Copilot CLI',
  'cursor-agent': 'Cursor Agent',
  goose: 'Goose',
  'kiro-cli': 'Kiro CLI',
  grok: 'Grok Build',
  pi: 'Pi',
  'oh-my-pi': 'oh-my-pi',
  hermes: 'Hermes Agent',
};

export const weightLabels: Record<number, string> = {
  [-2]: 'Strong miss',
  [-1]: 'Miss',
  0: 'Neutral',
  1: 'Win',
  2: 'Strong win',
};

export const outcomeLabels = {
  positive: 'Positive',
  negative: 'Negative',
  neutral: 'Neutral',
  pending: 'Pending',
} as const;

export function signedWeight(weight: number): string {
  return weight > 0 ? `+${weight}` : String(weight);
}
