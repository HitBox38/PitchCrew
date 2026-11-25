import { describe, expect, it } from 'vitest';
import type { Snapshot } from '@pitchcrew/core';
import {
  requestLabel,
  roleName,
  runAction,
  runAgentLabel,
  runDone,
  runPurposeLabels,
  runSubject,
  runWork,
} from '../run-labels.ts';
import { card, delivery, request, run, snapshot, task } from './attention-fixture.ts';

const data = snapshot({
  cards: [card('acme', { company: 'Acme Robotics' })],
  routines: [{ id: 'daily', name: 'Daily job scan' } as Snapshot['routines'][number]],
  conversations: [
    { id: 't-prep', title: 'Interview prep' } as NonNullable<Snapshot['conversations']>[number],
  ],
  chatRequests: [
    request('live', {
      content:
        'Compare the two offers line by line and tell me which one pays more after the relocation bonus',
    }),
    // The workspace snapshot blanks a settled request's text.
    request('settled', { content: '', compact: true }),
    // What answering a question queues: the agent's own instruction, never shown.
    request('answered', {
      content:
        'Continue your interrupted task after the user answered your question.\nOriginal request: Draft the cover letter',
      userInputId: 'question-1',
      deliveries: [delivery('writer', 'running', 'run-answered')],
    }),
  ],
  runs: [run('parent', { roleId: 'reviewer', status: 'completed' })],
  tasks: [
    task('follow', { parentRunId: 'parent', content: 'Fix the two claims Reviewer flagged.' }),
  ],
});

describe('run labels', () => {
  it('names a run’s action: purpose, routine, live request, follow-up, conversation', () => {
    expect(runAction(run('a', { purpose: 'fit' }), data)).toBe('Evaluating fit');
    expect(runAction(run('a', { routineId: 'daily' }), data)).toBe('Daily job scan');
    expect(runAction(run('a', { requestId: 'live', threadId: 't-prep' }), data)).toBe(
      'Compare the two offers line by line and tell…',
    );
    expect(runAction(run('a', { requestId: 'answered', threadId: 't-prep' }), data)).toBe(
      'Continue after your answer',
    );
    expect(runAction(run('a', { requestId: 'settled', threadId: 't-prep' }), data)).toBe(
      'Interview prep',
    );
    // Never the follow-up's own long instruction, which a one-line row would cut mid-word.
    expect(runAction(run('a', { taskId: 'follow', threadId: 't-prep' }), data)).toBe(
      'Follow-up for Reviewer',
    );
    expect(runAction(run('a'), data)).toBe('Chat');
    expect(runPurposeLabels['source-extraction']).toBe('Reading the job source');
  });

  it('words a request for a row beside its job: never a system prompt, never cut inside a word', () => {
    const label = (fields: Parameters<typeof request>[1]) =>
      requestLabel(request('r', { content: 'Hello', ...fields }), data);
    expect(label({ boardAction: 'draft' })).toBe('Draft application');
    expect(label({ userInputId: 'q', content: 'Continue your interrupted task after…' })).toBe(
      'Continue after your answer',
    );
    expect(
      label({ summarize: true, content: 'Create a concise continuation summary of this…' }),
    ).toBe('Summarize before continuing');
    expect(label({ routine: { routineId: 'daily', scheduledFor: '' }, content: 'Scan' })).toBe(
      'Daily job scan',
    );
    // A routine deleted since leaves its request's own words.
    expect(label({ routine: { routineId: 'gone', scheduledFor: '' }, content: 'Scan' })).toBe(
      'Scan',
    );
    const words = label({
      content: 'Compare the Halcyon and Globex offers and summarize the trade-offs for me',
    });
    expect(words).toBe('Compare the Halcyon and Globex offers and…');
    expect(words.length).toBeLessThanOrEqual(48);
    expect(label({ content: '', attachments: [{}, {}] as never })).toBe('2 attached files');
    expect(label({ content: '  ' })).toBe('Request');
  });

  it('names a run’s subject and agent', () => {
    expect(runSubject(run('a', { cardId: 'acme', routineId: 'daily' }), data)).toBe(
      'Acme Robotics',
    );
    expect(runSubject(run('a', { routineId: 'daily' }), data)).toBe('Daily job scan');
    expect(runSubject(run('a', { threadId: 't-prep' }), data)).toBe('Interview prep');
    expect(runSubject(run('a'), data)).toBe('Chat');
    expect(runAgentLabel(run('a', { taskId: 'follow' }), data)).toBe('Writer for Reviewer');
    expect(runAgentLabel(run('a', { roleId: 'reviewer', taskId: 'follow' }), data)).toBe(
      'Reviewer',
    );
    expect(runAgentLabel(run('a'), data)).toBe('Writer');
    expect(roleName(data, 'retired-helper')).toBe('An agent');
  });

  it('words finished work for “since” lines', () => {
    expect(runDone({ purpose: 'fit' })).toBe('evaluated fit for');
    expect(runDone({ purpose: 'deep-review' })).toBe('finished a deep review of');
    expect(runDone({ routineId: 'daily' })).toBe('ran');
    expect(runDone({})).toBe('replied in');
    expect(runWork(run('a', { purpose: 'fit' }), data)).toBe('fit evaluation');
    expect(runWork(run('a', { routineId: 'daily' }), data)).toBe('Daily job scan');
    expect(runWork(run('a', { taskId: 'follow' }), data)).toBe('follow-up');
    expect(runWork(run('a'), data)).toBe('reply');
    // A deleted routine leaves the snapshot; its runs keep the id and stay routine runs.
    expect(runWork(run('a', { routineId: 'deleted' }), data)).toBe('routine');
  });
});
