import type { ConversationHeadingProps } from './types.ts';
import type { Card, Role, Snapshot, Conversation } from '@pitchcrew/core';
import { conversationQueue, queueNeedsResume } from './queue-presentation.ts';

export const leadIsUnavailable = (
  data: Snapshot,
  conversation: Conversation | undefined,
  lead: Role | undefined,
) =>
  lead &&
  (!lead.enabled ||
    lead.retiredAt ||
    !data.runtimes.some(
      (runtime) =>
        runtime.id === (conversation?.configurations[lead.id]?.runtime ?? lead.runtime) &&
        runtime.available,
    ));
export const conversationSubtitle = (props: ConversationHeadingProps, lead: Role | undefined) => {
  if (props.conversation?.kind === 'history') return 'Crew history · read-only';
  if (props.conversation?.kind === 'agent_dm') return 'Agent collaboration · read-only';
  const queue = conversationQueue(props.data.queue, props.thread, props.data.conversations);
  const held = queueNeedsResume(queue)
    ? queue?.pauseKind === 'failed'
      ? 'Needs attention'
      : queue?.pauseKind === 'interrupted'
        ? 'Interrupted'
        : 'Paused'
    : null;
  if (props.participants.length > 1)
    return `${held ?? props.roleState} · ${props.participants.length} agents · ${lead ? `${lead.name} leads` : 'Choose a lead'}`;
  return `${held ?? props.roleState} · ${props.role.name}`;
};
/** "Fit 82 · Remote, EU" under a job chat's company and title; empty parts are left out. */
export const jobHeadingMeta = (card: Pick<Card, 'fit' | 'location'>) =>
  [card.fit === null ? '' : `Fit ${card.fit}`, card.location.trim()].filter(Boolean).join(' · ');
