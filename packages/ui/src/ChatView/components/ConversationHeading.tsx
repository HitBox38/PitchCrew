import { ConversationIdentity } from './ConversationIdentity.tsx';
import { BrowserButton } from '@/AgentBrowser/components/BrowserButton.tsx';
import type { ConversationHeadingProps } from '@/ChatView/types.ts';
import { Button } from '@pitchcrew/design-system/button';
import { runtimeLabels } from '@/lib/labels.ts';
import { ConversationActions } from './ConversationActions.tsx';
import { ConversationViewSwitch } from './ConversationViewSwitch.tsx';
import { Square, Cpu } from 'lucide-react';
import { ChatStageTrack } from '@/ClayInterface/components/ChatStageTrack.tsx';
import { ClayJobLinks } from './ClayJobLinks.tsx';
import { useSidebar } from '@pitchcrew/design-system/sidebar';
import { WorkspaceMobileTitle } from '@/App/components/WorkspaceHeaderSlots.tsx';
export const ConversationHeading = (props: ConversationHeadingProps) => {
  const { role, running, participants, setDialog, thread, working, action } = props;
  const { isMobile } = useSidebar();
  const mobileTitle = props.attached
    ? `${props.attached.company} · ${props.attached.title}`
    : (props.conversation?.title ?? role.name);
  return (
    <>
      <WorkspaceMobileTitle>
        <ConversationActions {...props} title={mobileTitle} />
      </WorkspaceMobileTitle>
      <header className="chat-heading">
        {isMobile && props.attached ? (
          <h1 className="sr-only">{mobileTitle}</h1>
        ) : (
          <ConversationIdentity {...props} />
        )}
        {isMobile ? (
          <div className="chat-mobile-view">
            <ConversationViewSwitch attention={props.attention} />
          </div>
        ) : (
          <ConversationViewSwitch attention={props.attention} />
        )}
        <ChatStageTrack thread={thread} />
        <div className="chat-heading-actions">
          <ClayJobLinks {...props} />
          <BrowserButton browserPanel={props.browserPanel} />
          {!props.readOnly ? (
            <Button
              variant="outline"
              className="chat-runtime"
              aria-label={`Conversation runtime: ${runtimeLabels[role.runtime]}`}
              onClick={() => setDialog('runtime')}
            >
              <Cpu size={13} />
              <span>{runtimeLabels[role.runtime]}</span>
            </Button>
          ) : null}
          {props.readOnly && running.length ? (
            <Button
              variant="outline"
              size="sm"
              disabled={working}
              onClick={() => void action(`/conversations/${thread}/stop`).catch(() => {})}
            >
              <Square size={12} /> Stop {participants.length > 1 ? 'group' : ''}
            </Button>
          ) : null}
          {isMobile ? null : <ConversationActions {...props} />}
        </div>
      </header>
    </>
  );
};
