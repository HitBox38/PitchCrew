import type { Agent, Phase } from './types';

export const agents: Agent[] = [
  {
    role: 'scout',
    name: 'Scout',
    runtime: 'Codex · GPT-6.1 Sol · Medium',
    capability: 'Scores the fit and reads postings as untrusted text.',
    run: { from: 0.1, to: 0.27 },
    working: 'Scoring Forma against your notes',
    finished: 'Scored Forma 85 of 100',
    idle: 'Ready',
  },
  {
    role: 'writer',
    name: 'Writer',
    runtime: 'Claude Code · Sonnet · High',
    capability: 'Drafts only from your notes, word for word.',
    run: { from: 0.3, to: 0.63 },
    working: 'Drafting the Forma packet',
    finished: 'Drafted the packet, 4 claims quoted',
    idle: 'Ready',
  },
  {
    role: 'reviewer',
    name: 'Reviewer',
    runtime: 'Codex · GPT-6 Astra · High',
    capability: 'Checks every claim against your notes and rules.',
    run: { from: 0.67, to: 0.87 },
    working: 'Checking the packet line by line',
    finished: 'Agreed: every claim quotes experience.md',
    idle: 'Ready',
  },
  {
    role: 'tracker',
    name: 'Tracker',
    runtime: 'Codex · GPT-6 Luna · High',
    capability: 'Follows replies after you apply, with Gmail only if you connect it.',
    working: 'Checking for replies',
    finished: 'Nothing to track yet',
    idle: 'Waiting for a submission',
  },
];

/** The rehearsal: each phase starts this many milliseconds after play begins. */
export const schedule: { phase: Phase; at: number }[] = [
  { phase: 'idle', at: 0 },
  { phase: 'scout', at: 500 },
  { phase: 'writer', at: 1750 },
  { phase: 'reviewer', at: 3000 },
  { phase: 'done', at: 4250 },
];

export const order: Record<Phase, number> = { idle: 0, scout: 1, writer: 2, reviewer: 3, done: 4 };

export const stages = [
  'Lead',
  'Shortlisted',
  'Drafting',
  'In review',
  'Approval',
  'Submitted',
  'Interviewing',
] as const;
