import { ConversationWelcome } from '@/ChatView/components/ConversationWelcome.tsx';
import { ConversationHistory } from './ConversationHistory.tsx';
import type { ConversationPanelProps } from '@/ChatView/types.ts';
import { TabsContent } from '@pitchcrew/design-system/tabs';
import { usePendingSends } from '../send-flight.ts';

export const ConversationPanel = ({
  answerQuestion,
  focusRunId,
  thread,
  role,
  name,
  messages,
  roleId,
  applyStarter,
  attached,
  data,
  streamingIds,
  reduced,
  onOpenCard,
  conversation,
  readOnly,
}: ConversationPanelProps) => {
  // A first message being sent replaces the welcome at once, so its pending copy never moves.
  const sending = usePendingSends((state) => !!state[thread]);
  return (
    <TabsContent
      value="conversation"
      className="chat-conversation-panel flex min-h-[var(--chat-history-min-height,0px)] flex-col"
    >
      <ConversationHistory
        key={`${thread}:${focusRunId ?? 'latest'}`}
        focusRunId={focusRunId}
        label={`${conversation?.title ?? role.name} messages`}
        answerQuestion={answerQuestion}
        messages={messages}
        data={data}
        streamingIds={streamingIds}
        reduced={reduced}
        name={name}
        thread={thread}
        onOpenCard={onOpenCard}
      >
        {!messages.length && !sending ? (
          <ConversationWelcome
            thread={thread}
            roleId={roleId}
            role={role}
            applyStarter={applyStarter}
            attached={attached}
            conversation={conversation}
            readOnly={readOnly}
          />
        ) : null}
      </ConversationHistory>
    </TabsContent>
  );
};
