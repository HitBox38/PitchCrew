import type { Card, ChatMessage, Run, UserInputRequest } from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';

/** Recover user-authored answers directly; never copy agent continuation notes or requests. */
export const applicationUserAnswers = (
  context: CrewContext,
  cardId: string,
  roleId: string,
  purpose: Run['purpose'],
) => {
  const requirements =
    context.board.get<Card>('card', cardId).applicationContext?.requirements ?? [];
  return context.board
    .list<UserInputRequest>('user_input')
    .filter(
      (question) =>
        question.status === 'answered' &&
        question.cardId === cardId &&
        question.roleId === roleId &&
        question.answer &&
        question.answerMessageId,
    )
    .filter((question) => {
      const origin = context.board.get<Run>('run', question.runId);
      return question.applicationRequirementId
        ? ['application-draft', 'application-review'].includes(origin.purpose ?? '')
        : purpose === 'fit' && origin.purpose === 'fit';
    })
    .flatMap((question) => {
      const message = context.board.get<ChatMessage>('message', question.answerMessageId!);
      const options = new Map(question.options.map((option) => [option.id, option.label]));
      const answer = [
        ...question.answer!.selected.map((id) => options.get(id)),
        question.answer!.text,
      ]
        .filter(Boolean)
        .join('\n');
      if (
        message.from !== 'user' ||
        message.cardId !== cardId ||
        message.content !== answer ||
        message.userInput?.id !== question.id
      )
        throw new Error('Application answer provenance is invalid. Ask the user again.');
      if (
        question.applicationRequirementId &&
        !requirements.some((r) => r.id === question.applicationRequirementId && r.answer === answer)
      )
        return [];
      return [{ questionId: question.id, messageId: message.id, answer }];
    })
    .slice(-40);
};
