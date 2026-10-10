import { ConversationWelcome } from '@/ChatView/components/ConversationWelcome.tsx';
import { MessageTranscript } from '@/ChatView/components/MessageTranscript.tsx';
import type { ConversationPanelProps } from '@/ChatView/types.ts';
import { Conversation } from '@/components/ai-elements/conversation/components/Conversation.tsx';
import { ConversationContent } from '@/components/ai-elements/conversation/components/ConversationContent.tsx';
import { ConversationScrollButton } from '@/components/ai-elements/conversation/components/ConversationScrollButton.tsx';
import { TabsContent } from '@/components/ui/tabs/components/TabsContent.tsx';

export function ConversationPanel({
  answerQuestion,
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
}: ConversationPanelProps) {
  return (
    <TabsContent value="conversation" className="chat-conversation-panel flex min-h-0 flex-col">
      <Conversation
        key={thread}
        className="chat-conversation"
        aria-label={`${conversation?.title ?? role.name} messages`}
      >
        <ConversationContent className="chat-transcript">
          {!messages.length ? (
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
          <MessageTranscript
            answerQuestion={answerQuestion}
            messages={messages}
            data={data}
            streamingIds={streamingIds}
            reduced={reduced}
            name={name}
            thread={thread}
            onOpenCard={onOpenCard}
          />
        </ConversationContent>
        <ConversationScrollButton className="button chat-scroll" />
      </Conversation>
    </TabsContent>
  );
}
