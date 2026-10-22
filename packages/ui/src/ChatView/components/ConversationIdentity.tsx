import type { ConversationHeadingProps } from '../types.ts';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Users } from 'lucide-react';
import { conversationSubtitle, leadIsUnavailable } from '../presentation.ts';

export const ConversationIdentity = (props: ConversationHeadingProps) => {
  const { conversation, roleId, participants, role, data, setDialog } = props;
  const lead = data.roles.find((agent) => agent.id === conversation?.leadId);
  const leadUnavailable = leadIsUnavailable(data, conversation, lead);
  // A lone agent with an uninstalled runtime needs a runtime, not a different lead.
  const pickRuntime =
    participants.length === 1 && !!lead && lead.enabled && !lead.retiredAt && !!leadUnavailable;
  return (
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
          {conversationSubtitle(props, lead)}
          {props.questions.length && participants.length > 1 ? (
            <span> · Waiting for you</span>
          ) : null}
          {leadUnavailable ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setDialog(pickRuntime ? 'runtime' : 'manage')}
            >
              {pickRuntime ? 'Choose runtime' : 'Choose new lead'}
            </Button>
          ) : null}
        </p>
      </div>
    </div>
  );
};
