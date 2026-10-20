import { createHash } from 'node:crypto';
import type { ChatReference, ChatReferenceInput, Conversation, Role, Skill } from '@pitchcrew/core';
import { chatTokens, skillToken } from '@pitchcrew/core/chat-references';
import type { CrewContext } from './types.ts';

export const skillDigest = (skill: Skill): string => {
  return createHash('sha256')
    .update(JSON.stringify([skill.name, skill.description, skill.content]))
    .digest('hex');
};
export const messageRecipients = (content: string, conversation: Conversation): string[] => {
  const mentions = chatTokens(content)
    .filter((token) => token.symbol === '@')
    .map((token) => token.query);
  return mentions.length
    ? conversation.participants.filter((id) => mentions.includes(id))
    : conversation.participants;
};
export const resolveChatReferences = (
  context: CrewContext,
  conversation: Conversation,
  content: string,
  supplied: ChatReferenceInput[] = [],
): ChatReference[] => {
  const tokens = chatTokens(content);
  const targets = messageRecipients(content, conversation).filter((id) => {
    const role = context.board.list<Role>('role').find((entry) => entry.id === id);
    const runtime = conversation.configurations[id]?.runtime ?? role?.runtime;
    return (
      role?.enabled &&
      !role.retiredAt &&
      context.runtimes.some((entry) => entry.id === runtime && entry.available)
    );
  });
  const skills = context.skills();
  const references: ChatReference[] = [];
  for (const input of supplied) {
    if (
      !tokens.some(
        (token) =>
          token.start === input.start &&
          token.end === input.end &&
          content.slice(token.start, token.end) === input.token,
      )
    )
      throw new Error(
        'A selected reference no longer matches the message. Remove it and choose it again.',
      );
  }
  for (const token of tokens) {
    const raw = content.slice(token.start, token.end);
    const selected = supplied.filter((ref) => ref.start === token.start && ref.end === token.end);
    if (selected.length > 1) throw new Error('Duplicate message reference.');
    const input = selected[0];
    let ref: ChatReference | undefined;
    if (token.symbol === '@') {
      const role = context.board
        .list<Role>('role')
        .find((role) => role.id === token.query && conversation.participants.includes(role.id));
      if (role)
        ref = {
          kind: 'agent',
          id: role.id,
          label: role.name,
          token: raw,
          start: token.start,
          end: token.end,
        };
    } else if (token.symbol === '$') {
      const matches = skills.filter((skill) =>
        input
          ? skill.id === input.id
          : [skillToken(skill.name), skillToken(skill.name, skill.id)].includes(raw),
      );
      if (matches.length > 1)
        throw new Error('This skill name is ambiguous. Choose it from the suggestions.');
      const skill = matches[0];
      if (skill) {
        if (![skillToken(skill.name), skillToken(skill.name, skill.id)].includes(raw))
          throw new Error('The selected skill changed. Choose it again.');
        if (input?.revision && input.revision !== skill.updatedAt)
          throw new Error('The selected skill changed. Choose it again.');
        if (!targets.some((id) => skill.scope === 'all' || skill.roleIds.includes(id)))
          throw new Error('This skill is not assigned to a requested participant.');
        ref = {
          kind: 'skill',
          id: skill.id,
          label: skill.name,
          token: raw,
          start: token.start,
          end: token.end,
          revision: skill.updatedAt,
          digest: skillDigest(skill),
        };
      }
    } else if (
      raw === '/hiring-panel' &&
      /^\s*(?:@[a-z][a-z0-9-]*\s+)*$/.test(content.slice(0, token.start))
    ) {
      ref = {
        kind: 'action',
        id: 'hiring-panel',
        label: 'Deep resume review',
        token: raw,
        start: token.start,
        end: token.end,
      };
    }
    if (input && (!ref || ref.id !== input.id || ref.kind !== input.kind))
      throw new Error(
        'A selected agent or skill is unavailable. Remove it or choose a replacement.',
      );
    if (ref) references.push(ref);
  }
  if (references.length > 32) throw new Error('Use at most 32 references in one message.');
  return references;
};

/** Revalidate at dispatch: queued messages cannot silently adopt changed instructions. */
export const selectedChatSkills = (
  context: CrewContext,
  references: ChatReference[] = [],
  roleId: string,
): Skill[] => {
  const selected: Skill[] = [];
  for (const ref of references.filter((ref) => ref.kind === 'skill')) {
    const skill = context.board.list<Skill>('skill').find((skill) => skill.id === ref.id);
    if (
      !skill ||
      skill.deletedAt ||
      skillDigest(skill) !== ref.digest ||
      skill.updatedAt !== ref.revision
    )
      throw new Error(
        `Selected skill “${ref.label}” changed or is unavailable. Edit the queued message and choose it again.`,
      );
    if (skill.scope === 'all' || skill.roleIds.includes(roleId)) selected.push(skill);
  }
  return selected.filter(
    (skill, index) => selected.findIndex((other) => other.id === skill.id) === index,
  );
};
