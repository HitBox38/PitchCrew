import type { Card, Conversation, Role, Snapshot } from '@pitchcrew/core';

/**
 * The agent that can check Gmail for a submission confirmation: enabled, not retired, allowed to
 * track applications and read Gmail, with a connected Google account granting Gmail. The seeded
 * Tracker is preferred when several qualify.
 */
export const gmailTracker = (
  data: Pick<Snapshot, 'roles' | 'connectors'>,
): Pick<Role, 'id' | 'name'> | undefined => {
  const google = data.connectors?.find((connector) => connector.id === 'google');
  if (!google?.connected || !google.services.includes('gmail')) return undefined;
  const eligible = data.roles.filter(
    (role) =>
      role.enabled &&
      !role.retiredAt &&
      role.capabilities?.trackApplications &&
      role.capabilities.gmail,
  );
  return eligible.find((role) => role.id === 'tracker') ?? eligible[0];
};

export type TrackerConversation =
  | { kind: 'current' }
  | { kind: 'existing'; id: string; participants: string[] }
  | { kind: 'create' };

const writable = (conversation: Conversation) =>
  !conversation.archived &&
  !conversation.deletedAt &&
  !['history', 'agent_dm'].includes(conversation.kind);

/** Prefer this conversation, then a writable conversation on the same job with the agent. */
export const trackerConversation = (
  conversations: readonly Conversation[] | undefined,
  current: Conversation | undefined,
  card: Pick<Card, 'id'>,
  trackerId: string,
): TrackerConversation => {
  if (current && writable(current) && current.participants.includes(trackerId))
    return { kind: 'current' };
  const job = conversations?.find(
    (item) => writable(item) && item.cardId === card.id && item.participants.includes(trackerId),
  );
  return job
    ? { kind: 'existing', id: job.id, participants: job.participants }
    : { kind: 'create' };
};

/** A draft for the user to send; groups address the agent so only it answers. */
export const trackerDraft = (
  card: Pick<Card, 'company' | 'title'>,
  trackerId: string,
  participants: readonly string[],
) =>
  `${participants.length > 1 ? `@${trackerId} ` : ''}Check Gmail for a confirmation of the ${card.company} ${card.title} application.`;
