import type { ConversationHeadingProps } from './types.ts';
import type { Role, Snapshot, Conversation } from '@pitchcrew/core';

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
  if (props.participants.length > 1)
    return `${props.participants.length} agents · ${lead ? `${lead.name} leads` : 'Choose a lead'}`;
  return `${props.role.name} · ${props.roleState}`;
};
