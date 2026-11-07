import { describe, expect, it } from 'vitest';
import {
  followUpLabels,
  messageTargets,
  nameList,
  recipientLabel,
  sendNote,
} from '../composer-status.ts';

const names: Record<string, string> = { writer: 'Writer', reviewer: 'Reviewer', scout: 'Scout' };
const name = (id: string) => names[id] ?? id;
const crew = ['writer', 'reviewer', 'scout'];
const idle = {
  hasInput: true,
  busy: false,
  busyElsewhere: false,
  sendMode: 'queue' as const,
  running: [],
  asking: [],
};

describe('composer recipient', () => {
  it('addresses everyone in a group unless participants are mentioned', () => {
    expect(recipientLabel(messageTargets('Draft it', crew), crew, name)).toBe('Everyone');
    expect(recipientLabel(messageTargets('@reviewer check', crew), crew, name)).toBe('Reviewer');
    expect(recipientLabel(messageTargets('@writer and @scout', crew), crew, name)).toBe(
      'Writer and Scout',
    );
    expect(recipientLabel(messageTargets('@tracker look', crew), crew, name)).toBe(
      'No participant',
    );
  });
  it('names the only agent in a direct conversation', () => {
    expect(recipientLabel(messageTargets('hi', ['writer']), ['writer'], name)).toBe('Writer');
  });
});

describe('composer send note', () => {
  it('says nothing when the message simply sends', () => {
    expect(sendNote(idle)).toBe('');
    expect(sendNote({ ...idle, busy: true, hasInput: false, running: ['Writer'] })).toBe('');
  });
  it('describes queueing and interrupting the running agent', () => {
    const busy = { ...idle, busy: true, running: ['Writer', 'Writer'] };
    expect(sendNote(busy)).toBe('Sends after Writer finishes');
    expect(sendNote({ ...busy, sendMode: 'interrupt' })).toBe('Interrupts Writer');
    expect(sendNote({ ...busy, running: ['Writer', 'Reviewer'] })).toBe(
      'Sends after Writer and Reviewer finish',
    );
  });
  it('describes work running in another conversation on the same job', () => {
    expect(followUpLabels({ busyElsewhere: true, running: [] })).toEqual({
      queue: 'Sends after current job work finishes',
      interrupt: 'Stops current work and sends',
    });
  });
  it('waits for a pending question when nothing runs', () => {
    expect(sendNote({ ...idle, asking: ['Reviewer'] })).toBe('Sends after you answer Reviewer');
  });
  it('explains that stopped and interrupted queues require an explicit resume before a message sends', () => {
    expect(sendNote({ ...idle, queuePaused: true })).toBe('Sends after you resume');
    expect(sendNote({ ...idle, queuePaused: true, asking: ['Reviewer'] })).toBe(
      'Sends after you answer Reviewer and resume the queue',
    );
    expect(sendNote({ ...idle, queuePaused: true, hasInput: false })).toBe('');
    expect(sendNote({ ...idle, busy: true, running: ['Scout'], queuePaused: true })).toBe(
      'Sends after you resume',
    );
    expect(
      sendNote({
        ...idle,
        busy: true,
        running: ['Scout'],
        queuePaused: true,
        sendMode: 'interrupt',
      }),
    ).toBe('Stops current work and resumes the queue to send');
  });
  it('explains the question gate even while another agent is running', () => {
    const input = { ...idle, busy: true, running: ['Scout'], asking: ['Reviewer'] };
    expect(sendNote(input)).toBe('Sends after you answer Reviewer and current work finishes');
    expect(sendNote({ ...input, sendMode: 'interrupt' })).toBe(
      'Stops current work, cancels pending questions and sends',
    );
  });
  it('uses the actual recovery action in failed, interrupted and cross-conversation holds', () => {
    expect(sendNote({ ...idle, queueHold: 'retry' })).toBe('Sends after you retry');
    expect(sendNote({ ...idle, queueHold: 'review' })).toBe('Sends after this queue continues');
    expect(sendNote({ ...idle, queueHold: 'retry', asking: ['Scout'] })).toBe(
      'Sends after you answer Scout and retry unfinished work',
    );
    expect(sendNote({ ...idle, queueHold: 'review', asking: ['Scout'] })).toBe(
      'Sends after you answer Scout and this queue continues',
    );
    expect(sendNote({ ...idle, queueHold: 'retry', busy: true, running: ['Scout'] })).toBe(
      'Sends after you retry',
    );
  });
  it('collapses long name lists', () => {
    expect(nameList(['A', 'B', 'C'])).toBe('A, B and C');
    expect(nameList(['A', 'B', 'C', 'D'])).toBe('4 agents');
  });
});
