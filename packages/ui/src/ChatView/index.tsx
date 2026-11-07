import { SubmissionVerification } from './components/SubmissionVerification.tsx';
import { RuntimeReadinessNotice } from '@/RuntimeMaintenance/components/RuntimeReadinessNotice.tsx';
import '@/styles/chat.css';
import { AgentBrowser } from '@/AgentBrowser/index.tsx';
import { validateAttachments } from './attachment-helpers.ts';
import type { CSSProperties } from 'react';
import { PendingQuestions } from '@/UserQuestions/index.tsx';
import { QuestionDockProvider } from '@/UserQuestions/QuestionDockProvider.tsx';
import { ConversationAnnouncer } from './components/ConversationAnnouncer.tsx';
import { ChatSettingsPanels } from './components/ChatSettingsPanels.tsx';
import { RelatedConversations } from './components/RelatedConversations.tsx';
import { ContinuationNotice } from './components/ContinuationNotice.tsx';
import { ConversationQueue } from './components/ConversationQueue.tsx';
import { ConversationInput } from './components/ConversationInput.tsx';
import { ConversationHeading } from '@/ChatView/components/ConversationHeading.tsx';
import { ConversationPanel } from '@/ChatView/components/ConversationPanel.tsx';
import { CrewWorkPanel } from '@/ChatView/components/CrewWorkPanel.tsx';
import { useChatView } from '@/ChatView/hooks/useChatView.ts';
import type { ChatViewProps } from '@/ChatView/types.ts';
import { Tabs } from '@pitchcrew/design-system/tabs';

export const ChatView = (props: ChatViewProps) => {
  const controller = useChatView(props);
  const { pane, setPane } = controller;
  return (
    <section
      className={`chat-workspace ${controller.roleId}`}
      data-chat-width={controller.width}
      data-browser-open={controller.browserPanel.open}
      style={{ '--browser-width': `${controller.browserPanel.width}px` } as CSSProperties}
      aria-label="Agent conversations"
    >
      <ConversationAnnouncer key={controller.thread} {...controller} />
      <QuestionDockProvider
        questions={controller.questions}
        activeQuestionId={controller.activeQuestionId}
        onWriteMessage={controller.writeMessage}
        onQuestionResolved={controller.questionResolved}
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
          <ConversationInput {...controller} />
        </Tabs>
      </QuestionDockProvider>
      <ChatSettingsPanels {...controller} />
      <AgentBrowser
        {...controller}
        onAttachBrowserFile={(file) => {
          const error = validateAttachments([...controller.files, file]);
          if (error) throw new Error(error);
          controller.addFiles([file]);
        }}
      />
    </section>
  );
};
