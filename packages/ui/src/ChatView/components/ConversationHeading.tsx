import { ConversationIdentity } from './ConversationIdentity.tsx';
import { BrowserButton } from '@/AgentBrowser/components/BrowserButton.tsx';
import type { ConversationHeadingProps } from '@/ChatView/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { runtimeLabels } from '@/lib/labels.ts';
import { ConversationActions } from './ConversationActions.tsx';
import { ConversationViewSwitch } from './ConversationViewSwitch.tsx';
import { Square, Cpu } from 'lucide-react';
import { ChatStageTrack } from '@/ClayInterface/components/ChatStageTrack.tsx';
import { ClayJobLinks } from './ClayJobLinks.tsx';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';
import { WorkspaceMobileTitle } from '@/App/components/WorkspaceHeaderSlots.tsx';
export const ConversationHeading = (props: ConversationHeadingProps) => {
  const { role, running, participants, setDialog, thread, working, action } = props;
  const { isMobile } = useSidebar();
  return (
    <>
      <WorkspaceMobileTitle>
        <ConversationActions {...props} title={props.conversation?.title ?? role.name} />
      </WorkspaceMobileTitle>
      <header className="chat-heading">
        <ConversationIdentity {...props} />
        <ConversationViewSwitch attention={props.attention} />
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
      <ChatStageTrack thread={thread} />
    </>
  );
};
