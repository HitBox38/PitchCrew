import type { CardState, RuntimeId } from '@pitchcrew/core';
import { PenLine, Search, ShieldCheck } from 'lucide-react';

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

export const roleIcons = { scout: Search, writer: PenLine, reviewer: ShieldCheck };

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
};
