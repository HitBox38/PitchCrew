import { afterEach, expect, it } from 'vitest';
import {
  Board,
  assertConfirmedContext,
  assertReviewedContext,
  jobSourceRevision,
  saveApplicationContext,
} from '../src/index.ts';
import { cardInput, inspectedApplicationForm, type Card } from '@pitchcrew/core';
import { formAssessment } from './fixtures/form.ts';
import { reviewFixturePacket } from './fixtures/application-context.ts';
import { packet } from './fixtures/packet.ts';

const boards: Board[] = [];
afterEach(() => {
  for (const board of boards.splice(0)) board.close();
});
const fixture = () => {
  const board = new Board(':memory:');
  boards.push(board);
  const card = board.createCard(
    cardInput.parse({ company: 'Fixture', title: 'Engineer', url: 'https://example.com/apply' }),
  );
  const context = {
    brief: { companyContext: '', responsibilities: [], qualifications: [], constraints: [] },
    requirements: [],
    flagged: [],
  };
  const save = (data: unknown) => {
    const current = board.get<Card>('card', card.id);
    return saveApplicationContext(
      board,
      card.id,
      jobSourceRevision(current),
      current.applicationContext?.revision ?? null,
      data,
      true,
    );
  };
  return { board, card, context, save };
};

it('requires inspection or an explicit manual choice for linked application drafting', () => {
  const { board, card, context, save } = fixture();
  expect(() => save(context)).toThrow('Inspect the application form');
  const uninspected = saveApplicationContext(
    board,
    card.id,
    jobSourceRevision(card),
    null,
    context,
    false,
  );
  expect(() => assertConfirmedContext(uninspected)).toThrow('Inspect the application form');
  const manual = save({ ...context, form: { status: 'manual' } });
  expect(assertConfirmedContext(manual).form).toEqual({ status: 'manual' });
});

it('binds reviewed requirements to actual inspected fields and rejects forged or changed metadata', () => {
  const { board, card, context, save } = fixture();
  const assessed = board.updateCard(
    card.id,
    { formAssessments: [formAssessment(card.id)] },
    'submitter',
    'Inspected fixture',
  );
  const form = inspectedApplicationForm(assessed)!;
  expect(form.status).toBe('inspected');
  if (form.status !== 'inspected') throw new Error('Expected inspected form');
  expect(() => save({ ...context, form: { ...form, fields: [] } })).toThrow(
    'inspected form changed',
  );
  save({ ...context, form });
  board.record(
    'card',
    { ...board.get<Card>('card', card.id), state: 'agreed', packet },
    'writer',
    'Fixture packet',
  );
  const reviewed = reviewFixturePacket(board, card.id);
  expect(assertReviewedContext(reviewed).form).toEqual(form);
  const approval = board.requestApproval(card.id);
  board.decideApproval(approval.id, true);
  const changed = formAssessment(card.id);
  changed.fields[0]!.accept = '.docx';
  const current = board.updateCard(
    card.id,
    { formAssessments: [changed] },
    'submitter',
    'Changed requirements',
  );
  expect(() => assertConfirmedContext(current)).toThrow('Inspect the application form');
  expect(() => assertReviewedContext(current)).toThrow('Inspect the application form');
  const adopted = save({ ...context, form: inspectedApplicationForm(current) });
  expect(adopted.packetReview).toBeUndefined();
  expect(board.get<{ status: string }>('approval', approval.id).status).toBe('rejected');
  board.rebuild();
  expect(board.get<Card>('card', card.id).applicationContext?.form).toEqual(
    adopted.applicationContext?.form,
  );
});
