import { afterEach, expect, it } from 'vitest';
import {
  beginQuestion,
  collapseQuestions,
  editQuestion,
  pendingQuestionId,
  reconcileQuestions,
  selectQuestion,
  updateQuestion,
  useQuestionState,
  dismissQuestionRecovery,
} from '../question-state.ts';

afterEach(() => useQuestionState.setState({ drafts: {}, docks: {}, recoveries: {} }));
it('keeps text and multiselect draft values by exact question across unrelated route state', () => {
  editQuestion('first', 'chat-a', {
    text: 'A long answer\nsecond line',
    selected: ['react', 'types'],
  });
  editQuestion('other', 'chat-b', { text: 'Another answer' });
  selectQuestion('chat-b', 'other');
  expect(useQuestionState.getState().drafts.first).toMatchObject({
    threadId: 'chat-a',
    text: 'A long answer\nsecond line',
    selected: ['react', 'types'],
  });
});
it('keeps a different local response after external resolution and prunes a matching submitted answer', () => {
  editQuestion('external', 'chat', { text: 'My local wording', selected: ['a'] });
  reconcileQuestions([
    {
      id: 'external',
      status: 'cancelled',
      question: 'Choose a topic',
      options: [{ id: 'a', label: 'Architecture', description: '' }],
    },
  ]);
  expect(useQuestionState.getState().recoveries.external).toMatchObject({
    text: 'My local wording',
    selected: ['Architecture'],
    status: 'cancelled',
  });
  editQuestion('owned', 'chat', { text: 'Saved response', selected: ['b'] });
  beginQuestion('owned', 'chat', false, { text: 'Saved response', selected: ['b'] });
  reconcileQuestions([
    { id: 'owned', status: 'answered', answer: { text: 'Saved response', selected: ['b'] } },
  ]);
  expect(useQuestionState.getState().drafts.owned).toBeUndefined();
  expect(useQuestionState.getState().recoveries.owned).toBeUndefined();
  dismissQuestionRecovery('external');
  expect(useQuestionState.getState().recoveries).toEqual({});
});
it('requires a change before repeating an identical definitely rejected answer', () => {
  const submitted = { text: 'Rejected wording', selected: [] };
  editQuestion('q', 'chat', submitted);
  const token = beginQuestion('q', 'chat', false, submitted)!;
  updateQuestion('q', token, { phase: 'idle', rejected: submitted, error: 'The form changed.' });
  expect(beginQuestion('q', 'chat', false, submitted)).toBeUndefined();
  editQuestion('q', 'chat', { text: 'A different answer' });
  expect(
    beginQuestion('q', 'chat', false, { text: 'A different answer', selected: [] }),
  ).toBeTypeOf('symbol');
});
it('prunes only authoritative resolutions and cancellation, never absence from a route or partial snapshot', () => {
  editQuestion('first', 'chat-a', { text: 'Keep me' });
  editQuestion('second', 'chat-b', { text: 'Keep me too' });
  reconcileQuestions([]);
  reconcileQuestions([{ id: 'first', status: 'pending' }]);
  expect(Object.keys(useQuestionState.getState().drafts)).toEqual(['first', 'second']);
  reconcileQuestions([{ id: 'first', status: 'answered' }]);
  expect(useQuestionState.getState().drafts.first).toBeUndefined();
  expect(useQuestionState.getState().drafts.second.text).toBe('Keep me too');
  reconcileQuestions([{ id: 'second', status: 'cancelled' }]);
  expect(useQuestionState.getState().drafts).toEqual({});
});
it('binds collapse to known IDs so the next/new question opens instead of inheriting a closed thread', () => {
  collapseQuestions('chat', ['first']);
  const current = () => useQuestionState.getState().docks.chat;
  expect(pendingQuestionId([{ id: 'first' }], current())).toBeUndefined();
  expect(pendingQuestionId([{ id: 'first' }, { id: 'second' }], current())).toBe('second');
  collapseQuestions('chat', ['first', 'second']);
  expect(pendingQuestionId([{ id: 'first' }, { id: 'second' }], current())).toBeUndefined();
  expect(pendingQuestionId([{ id: 'first' }, { id: 'second' }, { id: 'third' }], current())).toBe(
    'third',
  );
  selectQuestion('chat', 'second');
  expect(pendingQuestionId([{ id: 'first' }, { id: 'second' }, { id: 'third' }], current())).toBe(
    'second',
  );
  reconcileQuestions([{ id: 'second', status: 'answered' }]);
  expect(pendingQuestionId([{ id: 'first' }, { id: 'third' }], current())).toBe('third');
});
it('locks only the submitting question and rejects duplicate/stale operation updates', () => {
  editQuestion('first', 'chat', { text: 'Retained response' });
  const token = beginQuestion('first', 'chat', false)!;
  expect(beginQuestion('first', 'chat', false)).toBeUndefined();
  expect(beginQuestion('second', 'chat', false)).toBeTypeOf('symbol');
  updateQuestion('first', Symbol('stale'), { text: 'Wrong answer' });
  updateQuestion('first', token, {
    phase: 'uncertain',
    accepted: true,
    notice: 'Saved, checking status',
  });
  expect(useQuestionState.getState().drafts.first.text).toBe('Retained response');
  expect(beginQuestion('first', 'chat', false)).toBeUndefined();
  updateQuestion('first', token, { phase: 'idle', error: 'Still waiting' });
  const next = beginQuestion('first', 'chat', true)!;
  expect(next).not.toBe(token);
  updateQuestion('first', token, { text: 'Stale completion' });
  expect(useQuestionState.getState().drafts.first.text).toBe('Retained response');
});
