import { SubmissionVerification } from './components/SubmissionVerification.tsx';
import { RuntimeReadinessNotice } from '@/RuntimeMaintenance/components/RuntimeReadinessNotice.tsx';
import '@/styles/chat.css';
import { AgentBrowser } from '@/AgentBrowser/index.tsx';
import type { CSSProperties } from 'react';
import { PendingQuestions } from '@/UserQuestions/index.tsx';
import { ChatSettingsPanels } from './components/ChatSettingsPanels.tsx';
import { RelatedConversations } from './components/RelatedConversations.tsx';
import { ContinuationNotice } from './components/ContinuationNotice.tsx';
import { ConversationQueue } from './components/ConversationQueue.tsx';
import { ChatComposer } from '@/ChatView/components/ChatComposer.tsx';
import { ConversationHeading } from '@/ChatView/components/ConversationHeading.tsx';
import { ConversationPanel } from '@/ChatView/components/ConversationPanel.tsx';
import { CrewWorkPanel } from '@/ChatView/components/CrewWorkPanel.tsx';
import { useChatView } from '@/ChatView/hooks/useChatView.ts';
import type { ChatViewProps } from '@/ChatView/types.ts';
import { Tabs } from '@/components/ui/tabs/components/Tabs.tsx';

export const ChatView = (props: ChatViewProps) => {
  const controller = useChatView(props);
  const { pane, setPane } = controller;
  return (
    <section
      className={`chat-workspace ${controller.roleId}`}
      data-chat-width={controller.width}
      data-browser-open={controller.browserPanel.open && !controller.dialog}
      style={{ '--browser-width': `${controller.browserPanel.width}px` } as CSSProperties}
      aria-label="Agent conversations"
    >
      <Tabs
        value={pane}
        onValueChange={(value) => setPane(value as 'conversation' | 'work')}
        className="chat-panel"
      >
        <ConversationHeading {...controller} />
        <RelatedConversations {...controller} />
        <SubmissionVerification {...controller} />
        {pane === 'conversation' ? <ConversationPanel {...controller} /> : null}
        {pane === 'work' ? <CrewWorkPanel {...controller} /> : null}
        <RuntimeReadinessNotice {...controller} />
        <ContinuationNotice {...controller} />
        <ConversationQueue {...controller} />
        <PendingQuestions {...controller} />
        {controller.readOnly ? (
          <div className="chat-readonly">
            {controller.conversation?.kind === 'agent_dm'
              ? 'Agent DM · read-only. Start a separate conversation to give either agent direction.'
              : 'Crew history · read-only. Start a new conversation to continue working.'}
          </div>
        ) : (
          <ChatComposer {...controller} />
        )}
      </Tabs>
      <ChatSettingsPanels {...controller} />
      <AgentBrowser {...controller} hidden={!!controller.dialog} />
    </section>
  );
};
