import type { ChatReference, Role, Skill } from '@pitchcrew/core';
import { chatTokens, skillToken, type ChatToken } from '@pitchcrew/core/chat-references';
import type { ComposerSuggestion } from './types.ts';

export const composerSuggestions = (
  roles: Role[],
  skills: Skill[],
  participants: string[],
  text: string,
  jobLocked: boolean,
  unavailable: (role: Role) => string | undefined,
): ComposerSuggestion[] => {
  const mentions = chatTokens(text)
    .filter((token) => token.symbol === '@')
    .map((token) => token.query);
  const mentionIds = new Set(mentions);
  const participantIds = new Set(participants);
  const targets = mentions.length ? participants.filter((id) => mentionIds.has(id)) : participants;
  const agents = roles
    .filter((role) => participantIds.has(role.id))
    .map((role) => ({
      key: `agent:${role.id}`,
      label: role.name,
      description: `@${role.id}`,
      disabled: unavailable(role),
      reference: { kind: 'agent' as const, id: role.id, token: `@${role.id}`, label: role.name },
    }));
  const targetIds = new Set(targets);
  const eligibleTargets = roles
    .filter((role) => targetIds.has(role.id) && !unavailable(role))
    .map((role) => role.id);
  const available = skills.filter(
    (skill) =>
      !skill.deletedAt &&
      eligibleTargets.some((id) => skill.scope === 'all' || skill.roleIds.includes(id)),
  );
  const assigned = available.map((skill) => ({
    key: `skill:${skill.id}`,
    label: skill.name,
    description: skill.description || 'Selected instructions for this message',
    reference: {
      kind: 'skill' as const,
      id: skill.id,
      token: skillToken(
        skill.name,
        skills.filter(
          (other) => !other.deletedAt && skillToken(other.name) === skillToken(skill.name),
        ).length > 1
          ? skill.id
          : undefined,
      ),
      label: skill.name,
      revision: skill.updatedAt,
    },
  }));
  return [
    ...agents,
    {
      key: 'action:hiring-panel',
      label: '/hiring-panel',
      description: 'Prepare a deep resume review',
      reference: {
        kind: 'action',
        id: 'hiring-panel',
        token: '/hiring-panel',
        label: 'Deep resume review',
      },
    },
    {
      key: 'action:attach',
      label: '/attach',
      description: 'Choose files for this message',
      action: 'attach',
    },
    {
      key: 'action:job',
      label: '/job',
      description: 'Choose the conversation job',
      action: 'job',
      disabled: jobLocked ? 'Job fixed after the first message' : undefined,
    },
    {
      key: 'action:skills',
      label: '/skills',
      description: 'Browse assigned skills',
      action: 'skills',
    },
    ...assigned,
  ];
};
const score = (query: string, text: string): number => {
  text = text.toLowerCase();
  if (text === query) return 0;
  if (text.startsWith(query)) return 1;
  if (text.includes(query)) return 2;
  let at = 0;
  for (const character of query) {
    at = text.indexOf(character, at);
    if (at < 0) return Infinity;
    at++;
  }
  return 3;
};
export const filterSuggestions = (
  items: ComposerSuggestion[],
  trigger: ChatToken,
): ComposerSuggestion[] => {
  const query = trigger.query.toLowerCase();
  return items
    .filter((item) =>
      trigger.symbol === '@'
        ? item.reference?.kind === 'agent'
        : trigger.symbol === '$'
          ? item.reference?.kind === 'skill'
          : item.reference?.kind !== 'agent',
    )
    .map((item, index) => ({
      item,
      index,
      rank: Math.min(
        score(query, item.label.replace(/^\//, '')),
        score(query, item.reference?.token.slice(1) ?? ''),
      ),
    }))
    .filter((entry) => Number.isFinite(entry.rank))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item);
};
export const trimmedReferences = (text: string, references: ChatReference[]) => {
  const offset = text.length - text.trimStart().length;
  return references
    .map((reference) => ({
      ...reference,
      start: reference.start - offset,
      end: reference.end - offset,
    }))
    .filter((ref) => ref.start >= 0 && ref.end <= text.trim().length);
};
