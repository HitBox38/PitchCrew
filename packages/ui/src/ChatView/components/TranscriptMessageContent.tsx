import { AnswerMessage } from '@/UserQuestions/components/AnswerMessage.tsx';
import type { ChatMessage, Snapshot } from '@pitchcrew/core';
import { QuestionMessage } from '@/UserQuestions/components/QuestionMessage.tsx';
import { MessageContent } from '@/components/ai-elements/message/components/MessageContent.tsx';
import { ReferenceMessage } from '@/ChatReferences/index.tsx';
import { MessageAttachments } from './MessageAttachments.tsx';
export const TranscriptMessageContent = ({
  message,
  data,
  streaming,
  answerQuestion,
}: {
  message: ChatMessage;
  data: Snapshot;
  streaming: boolean;
  answerQuestion: (id: string) => void;
}) => {
  const question = message.userInput
    ? data.userInputs?.find((q) => q.id === message.userInput?.id)
    : undefined;
  return (
    <MessageContent className="chat-message-content" aria-busy={streaming}>
      {question && message.userInput?.kind === 'answer' ? (
        <AnswerMessage question={question} />
      ) : question ? (
        <QuestionMessage question={question} data={data} onAnswer={answerQuestion} />
      ) : (
        <ReferenceMessage
          message={message}
          catalog={{ roles: data.roles, skills: data.skills ?? [] }}
          streaming={streaming}
        />
      )}
      <MessageAttachments message={message} />
    </MessageContent>
  );
};
