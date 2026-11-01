import type { Role, RoleProposal, SkillProposal } from '@pitchcrew/core';
import { capabilityDefaults, capabilityLabels } from '../agent-capabilities.ts';
import { diffCounts, diffInstructions } from '../components/InstructionUpdate/helpers.ts';

type CapabilityKey = keyof typeof capabilityLabels;
export type CapabilityChange = {
  key: CapabilityKey;
  label: string;
  before: boolean;
  after: boolean;
};

const enabled = (role: Role, key: CapabilityKey) =>
  role.capabilities?.[key] ?? capabilityDefaults[key];

/** Proposed capabilities that differ from the role, plus how many stay as they are. */
export const capabilityDiff = (
  current: Role,
  changes: NonNullable<RoleProposal['changes']['capabilities']>,
) => {
  const entries = Object.entries(changes).filter(([key]) => key in capabilityLabels);
  const changed: CapabilityChange[] = entries
    .map(([key, after]) => ({
      key: key as CapabilityKey,
      label: capabilityLabels[key as CapabilityKey],
      before: enabled(current, key as CapabilityKey),
      after: after === true,
    }))
    .filter((item) => item.before !== item.after);
  return { changed, unchanged: entries.length - changed.length };
};

const plural = (count: number, word: string, many = `${word}s`) =>
  `${count} ${count === 1 ? word : many}`;

const list = (parts: string[]) =>
  parts.length < 2 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;

const sentence = (parts: string[]) => {
  const text = list(parts);
  return text ? `${text[0].toUpperCase()}${text.slice(1)}.` : '';
};

/** One line saying what applying a role proposal would change. */
export const roleProposalSummary = (proposal: RoleProposal, current: Role): string => {
  const parts: string[] = [];
  const instructions = proposal.changes.instructions;
  if (instructions !== undefined) {
    const counts = diffCounts(diffInstructions(current.instructions, instructions));
    if (counts.added && counts.removed)
      parts.push(
        `changes ${plural(Math.max(counts.added, counts.removed), 'paragraph')} in the instructions`,
      );
    else if (counts.added)
      parts.push(`adds ${plural(counts.added, 'paragraph')} to the instructions`);
    else if (counts.removed)
      parts.push(`removes ${plural(counts.removed, 'paragraph')} from the instructions`);
  }
  if (proposal.changes.capabilities) {
    const { changed } = capabilityDiff(current, proposal.changes.capabilities);
    const on = changed.filter((item) => item.after).length;
    const off = changed.length - on;
    if (on) parts.push(`turns on ${plural(on, 'capability', 'capabilities')}`);
    if (off) parts.push(`turns off ${plural(off, 'capability', 'capabilities')}`);
  }
  return sentence(parts) || 'Leaves the current settings as they are.';
};

/** One line saying which skill would be added and who would use it. */
export const skillProposalSummary = (
  proposal: SkillProposal,
  name: (id: string) => string,
): string => {
  const { skill } = proposal;
  const who = skill.scope === 'all' ? 'all agents' : list(skill.roleIds.map(name));
  return `Adds “${skill.name}” for ${who}${skill.source ? ', imported from skills.sh' : ''}.`;
};
