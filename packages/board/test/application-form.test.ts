import { afterEach, expect, it } from 'vitest';
import {
  Board,
  assertConfirmedContext,
  assertReviewedContext,
  jobSourceRevision,
  saveApplicationContext,
} from '../src/index.ts';
import {
  applicationFormSchema,
  cardInput,
  currentEventVersion,
  decodeEvent,
  inspectedApplicationForm,
  type Card,
} from '@pitchcrew/core';
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
  const inspection = { ...formAssessment(card.id), fields: [] };
  const partial = board.updateCard(
    card.id,
    { formAssessments: [inspection] },
    'submitter',
    'Partial inspection',
  );
  const hold = 'Review the latest form inspection in the application brief';
  expect(() => assertConfirmedContext(partial)).toThrow(hold);
  expect(() => assertConfirmedContext({ ...uninspected, formAssessments: [inspection] })).toThrow(
    hold,
  );
  expect(() => save({ ...context, form: { status: 'manual' } })).toThrow(
    'inspected form requirements',
  );
  const adopted = save({ ...context, form: inspectedApplicationForm(partial) });
  expect(assertConfirmedContext(adopted).form).toMatchObject({
    status: 'inspected',
    fields: [],
    uninspected: expect.arrayContaining(['No application controls were inspected.']),
  });
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
  expect(() => assertConfirmedContext(current)).toThrow('Review the latest form inspection');
  expect(() => assertReviewedContext(current)).toThrow('Review the latest form inspection');
  const adopted = save({ ...context, form: inspectedApplicationForm(current) });
  expect(adopted.packetReview).toBeUndefined();
  expect(board.get<{ status: string }>('approval', approval.id).status).toBe('rejected');
  board.rebuild();
  expect(board.get<Card>('card', card.id).applicationContext?.form).toEqual(
    adopted.applicationContext?.form,
  );
});

it('retains constraint/group/choice evidence through confirmation and replay, making changed constraints stale', () => {
  const { board, card, context, save } = fixture();
  const assessment = formAssessment(card.id);
  assessment.fields[1] = {
    ...assessment.fields[1]!,
    constraints: {
      minLength: { status: 'declared', value: '20' },
      maxLength: { status: 'declared', value: '500' },
      min: { status: 'absent' },
      max: { status: 'unavailable' },
      step: { status: 'absent' },
      uploadSizeLimit: 'unknown',
    },
    optionsTotal: 105,
    optionsTruncated: true,
    group: { role: 'radiogroup', label: 'Fictional question', required: true },
  };
  const assessed = board.updateCard(
    card.id,
    { formAssessments: [assessment] },
    'submitter',
    'Fixture evidence',
  );
  const form = inspectedApplicationForm(assessed)!;
  const confirmed = save({ ...context, form });
  expect(assertConfirmedContext(confirmed).form).toEqual(form);
  const rawEvents = board.events().map((event) => JSON.stringify(event));
  expect(board.events()[0]!.version).toBe(currentEventVersion);
  board.rebuild();
  expect(board.get<Card>('card', card.id).applicationContext?.form).toEqual(form);
  expect(board.events().map((event) => JSON.stringify(event))).toEqual(rawEvents);
  if (form.status !== 'inspected') throw new Error('Expected inspected form');
  expect(
    applicationFormSchema.safeParse({
      ...form,
      fields: [
        {
          ...form.fields[1],
          constraints: {
            ...form.fields[1]!.constraints,
            minLength: { status: 'declared', value: 'x'.repeat(201) },
          },
        },
      ],
    }).success,
  ).toBe(false);
  assessment.fields[1]!.constraints!.minLength = { status: 'declared', value: '21' };
  const changed = board.updateCard(
    card.id,
    { formAssessments: [assessment] },
    'submitter',
    'Changed length',
  );
  expect(() => assertConfirmedContext(changed)).toThrow('Review the latest form inspection');
});

it('keeps historical absent evidence unavailable without rewriting version 37 records', () => {
  const { board, card } = fixture();
  const assessment = formAssessment(card.id);
  const event = {
    id: 1,
    version: 37,
    kind: 'form_assessment',
    entityId: assessment.id,
    actor: 'submitter',
    message: 'Historical fixture',
    data: assessment,
    createdAt: assessment.createdAt,
  };
  const raw = JSON.stringify(event);
  expect(decodeEvent(raw).data).toEqual(assessment);
  board.db.prepare('INSERT INTO events(json) VALUES (?)').run(raw);
  board.rebuild();
  const form = inspectedApplicationForm({ formAssessments: [assessment] });
  expect(form?.status).toBe('inspected');
  if (form?.status !== 'inspected') throw new Error('Expected historical form');
  expect(form.fields[0]!.constraints).toBeUndefined();
  expect(form.fields[0]!.optionsTruncated).toBeUndefined();
  expect(form.fields[0]!.group).toBeUndefined();
  expect(
    (board.db.prepare('SELECT json FROM events ORDER BY id DESC LIMIT 1').get() as { json: string })
      .json,
  ).toBe(raw);
});
