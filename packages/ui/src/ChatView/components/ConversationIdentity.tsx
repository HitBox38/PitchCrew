import type { ConversationHeadingProps } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { conversationSubtitle, leadIsUnavailable } from '../presentation.ts';
import { ChatParticipants } from '@/ClayInterface/components/ChatParticipants.tsx';
import { ClayJobTitle } from './ClayJobTitle.tsx';

export const ConversationIdentity = (props: ConversationHeadingProps) => {
  const { conversation, participants, role, data, setDialog } = props;
  const lead = data.roles.find((agent) => agent.id === conversation?.leadId);
  const leadUnavailable = leadIsUnavailable(data, conversation, lead);
  // A lone agent with an uninstalled runtime needs a runtime, not a different lead.
  const pickRuntime =
    participants.length === 1 && !!lead && lead.enabled && !lead.retiredAt && !!leadUnavailable;
  const job = props.attached;
  const title = conversation?.title ?? role.name;
  return (
    <div className="chat-heading-identity" data-job={job ? '' : undefined}>
      <ChatParticipants
        participants={participants}
        running={props.running}
        questions={props.questions}
        data={data}
      />
      <div className="chat-heading-copy">
        {job ? <ClayJobTitle card={job} /> : <h1>{title}</h1>}
        <p>
          {job ? <span className="clay-chat-title">{title} · </span> : null}
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
