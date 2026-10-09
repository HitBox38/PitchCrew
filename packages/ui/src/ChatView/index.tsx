import { PendingQuestions } from '@/UserQuestions/index.tsx';
import { ChatSettingsPanels } from './components/ChatSettingsPanels.tsx';
import { RelatedConversations } from './components/RelatedConversations.tsx';
import { ContinuationNotice } from './components/ContinuationNotice.tsx';
import { ConversationQueue } from './components/ConversationQueue.tsx';
import { ChatComposer } from '@/ChatView/components/ChatComposer.tsx';
import { ChatProgress } from '@/ChatView/components/ChatProgress.tsx';
import { ConversationHeading } from '@/ChatView/components/ConversationHeading.tsx';
import { ConversationPanel } from '@/ChatView/components/ConversationPanel.tsx';
import { CrewWorkPanel } from '@/ChatView/components/CrewWorkPanel.tsx';
import { useChatView } from '@/ChatView/hooks/useChatView.ts';
import type { ChatViewProps } from '@/ChatView/types.ts';
import { Tabs } from '@/components/ui/tabs/components/Tabs.tsx';

export function ChatView(props: ChatViewProps) {
  const controller = useChatView(props);
  const { pane, setPane, running } = controller;
  return (
    <section
      className={`chat-workspace ${controller.roleId}`}
      data-chat-width={controller.width}
      aria-label="Agent conversations"
    >
      <Tabs
        value={pane}
        onValueChange={(value) => setPane(value as 'conversation' | 'work')}
        className="chat-panel"
      >
        <ConversationHeading {...controller} />
        <RelatedConversations {...controller} />
        {pane === 'conversation' ? <ConversationPanel {...controller} /> : null}
        {pane === 'work' ? <CrewWorkPanel {...controller} /> : null}
        {running.length ? <ChatProgress {...controller} /> : null}
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
    </section>
  );
}
