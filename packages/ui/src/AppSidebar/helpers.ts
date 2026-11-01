import type { Snapshot } from '@pitchcrew/core';
import { pendingInstructionUpdates } from '../lib/instruction-updates.ts';
import { pendingSkillUpdates } from '../lib/skill-updates.ts';
import type { SidebarCounts } from './types.ts';

/**
 * Badge counts for the sidebar: Decisions waiting on the user, Crew updates and proposals, Profile
 * maintenance proposals to review, and Skills updates (shown in More).
 */
export const sidebarCounts = (data: Snapshot, decisions: number): SidebarCounts => ({
  inbox: decisions,
  crew:
    pendingInstructionUpdates(data).length +
    data.proposals.filter((proposal) => proposal.status === 'pending').length +
    data.skillProposals.filter((proposal) => proposal.status === 'pending').length,
  profile: (data.profileProposals ?? []).filter((proposal) =>
    ['pending', 'applying'].includes(proposal.status),
  ).length,
  skills: pendingSkillUpdates(data).length,
});

/** Accessible name for a counted nav row, e.g. “Crew, 2 updates or proposals”. */
export const countedLabel = (label: string, count: number, noun: string) =>
  count ? `${label}, ${count} ${noun}` : label;
