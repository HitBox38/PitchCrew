import { Board, jobSourceRevision, saveApplicationContext } from '@pitchcrew/board';
import {
  cardInput,
  inspectedApplicationForm,
  type Card,
  type Run,
  type UserInputRequest,
} from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { formAssessment } from '../../board/test/fixtures/form.ts';
import { applicationUserAnswers } from '../src/crew/application-context/answers.ts';
import type { CrewContext } from '../src/crew/types.ts';

it('shares only confirmed form answers across packet roles and excludes source-discussion and stale answers', () => {
  const board = new Board(':memory:');
  try {
    const card = board.createCard(cardInput.parse({ company: 'Fixture', title: 'Engineer' }));
    const assessed = board.updateCard(
      card.id,
      { formAssessments: [formAssessment(card.id)] },
      'submitter',
      'Fixture inspection',
    );
    const data = {
      brief: { companyContext: '', responsibilities: [], qualifications: [], constraints: [] },
      requirements: [],
      flagged: [],
      form: inspectedApplicationForm(assessed),
    };
    const adopted = saveApplicationContext(
      board,
      card.id,
      jobSourceRevision(card),
      null,
      data,
      true,
    );
    const revision = adopted.applicationContext!.revision;
    for (const [index, purpose] of (['application-draft', 'fit', undefined] as const).entries()) {
      const id = `answer-${index}`;
      const run: Run = {
        id,
        cardId: card.id,
        roleId: 'writer',
        runtime: 'demo',
        purpose,
        status: 'completed',
        message: '',
        startedAt: '',
        finishedAt: '',
      };
      board.record('run', run, 'writer', 'Fixture question origin');
      const question: UserInputRequest = {
        id,
        roleId: 'writer',
        runId: id,
        threadId: 'writer',
        sourceThreadId: 'writer',
        cardId: card.id,
        messageId: `${id}-question`,
        question: 'Why this team?',
        reason: '',
        continuationNotes: 'Untrusted continuation text',
        options: [],
        multiSelect: false,
        createdAt: '',
        status: 'answered',
        applicationContextRevision: revision,
        answer: { selected: [], text: `User answer ${index}` },
        answerMessageId: `${id}-message`,
      };
      board.record('user_input', question, 'writer', 'Fixture answer');
      board.record(
        'message',
        {
          id: question.answerMessageId!,
          threadId: 'writer',
          cardId: card.id,
          from: 'user',
          to: 'writer',
          content: question.answer!.text,
          runId: null,
          createdAt: '',
          userInput: { id, kind: 'answer' },
        },
        'user',
        'Fixture user evidence',
      );
    }
    const context = { board } as CrewContext;
    expect(applicationUserAnswers(context, card.id, 'reviewer', 'application-review')).toEqual([
      {
        questionId: 'answer-0',
        messageId: 'answer-0-message',
        answer: 'User answer 0',
        question: 'Why this team?',
      },
    ]);
    const current = board.get<Card>('card', card.id);
    saveApplicationContext(
      board,
      card.id,
      jobSourceRevision(current),
      revision,
      { ...data, brief: { ...data.brief, companyContext: 'Changed confirmed context' } },
      true,
    );
    expect(applicationUserAnswers(context, card.id, 'reviewer', 'application-review')).toEqual([]);
  } finally {
    board.close();
  }
});
