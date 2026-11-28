import {
  formHasQuestion,
  type Card,
  type ChatMessage,
  type Run,
  type UserInputRequest,
} from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';

/** Recover user-authored answers directly; never copy agent continuation notes or requests. */
export const applicationUserAnswers = (
  context: CrewContext,
  cardId: string,
  roleId: string,
  purpose: Run['purpose'],
) => {
  const application = context.board.get<Card>('card', cardId).applicationContext;
  const requirements = application?.requirements ?? [];
  const assessment = ['fit', 'packet-evaluation'].includes(purpose ?? '');
  const packetWork = ['application-draft', 'application-review'].includes(purpose ?? '');
  const isFormQuestion = (question: UserInputRequest) =>
    Boolean(
      application &&
      question.applicationContextRevision === application.revision &&
      formHasQuestion(application.form, question.question),
    );
  return context.board
    .list<UserInputRequest>('user_input')
    .filter(
      (question) =>
        question.status === 'answered' &&
        question.cardId === cardId &&
        question.answer &&
        question.answerMessageId,
    )
    .filter((question) => {
      const origin = context.board.get<Run>('run', question.runId);
      const packetOrigin = ['application-draft', 'application-review'].includes(
        origin.purpose ?? '',
      );
      if (question.applicationRequirementId)
        return packetOrigin && (packetWork || question.roleId === roleId);
      if (packetWork) return packetOrigin && isFormQuestion(question);
      return (
        assessment &&
        question.roleId === roleId &&
        ['fit', 'packet-evaluation'].includes(origin.purpose ?? '')
      );
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
        !requirements.some(
          (r) =>
            r.personal &&
            r.id === question.applicationRequirementId &&
            r.question === question.question &&
            r.answer === answer,
        )
      )
        return [];
      return [
        {
          questionId: question.id,
          messageId: message.id,
          answer,
          question: question.question,
        },
      ];
    })
    .slice(-40);
};
