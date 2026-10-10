import type { ConversationHeadingProps } from '@/ChatView/types.ts';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { runtimeLabels } from '@/lib/labels.ts';
import { ConversationActions } from './ConversationActions.tsx';
import { ConversationViewSwitch } from './ConversationViewSwitch.tsx';
import { Users, Square, Cpu } from 'lucide-react';
export function ConversationHeading(props: ConversationHeadingProps) {
  const {
    conversation,
    roleId,
    role,
    roleState,
    running,
    data,
    participants,
    setDialog,
    thread,
    working,
    action,
  } = props;
  const lead = data.roles.find((agent) => agent.id === conversation?.leadId);
  const leadUnavailable =
    lead &&
    (!lead.enabled ||
      lead.retiredAt ||
      !data.runtimes.some(
        (runtime) =>
          runtime.id === (conversation?.configurations[lead.id]?.runtime ?? lead.runtime) &&
          runtime.available,
      ));
  return (
    <header className="chat-heading">
      <div className="chat-heading-identity">
        {participants.length === 1 ? (
          <RoleAvatar agentRole={roleId} size="normal" />
        ) : (
          <span className="crew-chat-icon">
            <Users size={18} />
          </span>
        )}
        <div className="chat-heading-copy">
          <h2>{conversation?.title ?? role.name}</h2>
          <p>
            {conversation?.kind === 'history'
              ? 'Crew history · read-only'
              : conversation?.kind === 'agent_dm'
                ? 'Agent collaboration · read-only'
                : participants.length > 1
                  ? `${participants.length} agents · ${lead ? `${lead.name} leads` : 'Choose a lead'}`
                  : `${role.name} · ${roleState}`}
            {props.questions.length && participants.length > 1 ? (
              <span> · Waiting for you</span>
            ) : null}
            {leadUnavailable ? (
              <Button variant="ghost" size="xs" onClick={() => setDialog('manage')}>
                Choose new lead
              </Button>
            ) : null}
          </p>
        </div>
      </div>
      <ConversationViewSwitch attention={props.attention} />
      <div className="chat-heading-actions">
        {!props.readOnly ? (
          <Button variant="outline" className="chat-runtime" onClick={() => setDialog('runtime')}>
            <Cpu size={13} />
            {runtimeLabels[role.runtime]}
          </Button>
        ) : null}
        {running.length ? (
          <Button
            variant="outline"
            size="sm"
            disabled={working}
            onClick={() => void action(`/conversations/${thread}/stop`).catch(() => {})}
          >
            <Square size={12} /> Stop {participants.length > 1 ? 'group' : ''}
          </Button>
        ) : null}
        <ConversationActions {...props} />
      </div>
    </header>
  );
}
