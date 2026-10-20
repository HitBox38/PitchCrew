import type { ChatMessage, Run, UserInputRequest } from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';
/** Only user-authored answers to questions from this isolated review, never chat history. */
export const reviewClarifications = (context: CrewContext, reviewId: string) => {
  return context.board
    .list<UserInputRequest>('user_input')
    .filter(
      (q) =>
        q.status === 'answered' &&
        q.answerMessageId &&
        context.board.get<Run>('run', q.runId).deepReviewId === reviewId,
    )
    .slice(-40)
    .map((q) => {
      const message = context.board.get<ChatMessage>('message', q.answerMessageId!);
      const options = new Map(q.options.map((option) => [option.id, option.label]));
      const answer = [...q.answer!.selected.map((id) => options.get(id)), q.answer!.text]
        .filter(Boolean)
        .join('\n');
      if (
        message.from !== 'user' ||
        message.userInput?.id !== q.id ||
        message.cardId !== q.cardId ||
        message.content !== answer
      )
        throw new Error('Deep-review answer provenance is invalid.');
      return { question: q.question, answer };
    });
};
