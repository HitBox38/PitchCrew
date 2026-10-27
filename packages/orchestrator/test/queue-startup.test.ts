import { expect, it } from 'vitest';
import { Board } from '@pitchcrew/board';
import type { ChatRequest, Conversation, Role } from '@pitchcrew/core';
import type { CrewContext } from '../src/crew/types.ts';
import { drainConversationQueue } from '../src/crew/conversation-queue.ts';

it('defers expensive prerequisite reads until capacity is available, then validates again', async () => {
  const board = new Board(':memory:');
  try {
    const thread: Conversation = {
      id: 'fictional-thread',
      title: 'Fictional application',
      kind: 'application',
      participants: ['writer'],
      leadId: 'writer',
      cardId: 'fictional-job',
      createdBy: 'user',
      createdAt: '',
      updatedAt: '',
      archived: false,
      pinned: false,
      configurations: {},
    };
    const request: ChatRequest = {
      id: 'fictional-request',
      threadId: thread.id,
      messageId: 'fictional-message',
      content: 'Draft application',
      attachments: [],
      boardAction: 'draft',
      createdAt: '',
      order: 1,
      deliveries: [{ roleId: 'writer', status: 'queued', runId: null, error: '' }],
    };
    board.record('conversation', thread, 'user', 'Fixture');
    board.record('chat_request', request, 'user', 'Fixture');
    board.record(
      'role',
      { id: 'writer', enabled: true, runtime: 'demo' } as Role,
      'user',
      'Fixture',
    );
    board.record('queue_settings', { id: 'workspace', concurrency: 1 }, 'user', 'Fixture');
    const queueReservations = new Map([
      ['other', { lane: 'job:other', root: 'other', thread: 'other', role: 'writer' }],
    ]);
    let prerequisiteReads = 0;
    const context = {
      get runtimes() {
        prerequisiteReads += 1;
        return [];
      },
      board,
      queueReservations,
      queueChains: new Map(),
      controllers: new Map(),
    } as unknown as CrewContext;
    await drainConversationQueue(context);
    expect(prerequisiteReads).toBe(0);
    expect(board.get<ChatRequest>('chat_request', request.id).deliveries[0].status).toBe('queued');
    queueReservations.clear();
    await drainConversationQueue(context);
    expect(board.list<{ reason: string }>('work_queue')[0].reason).toContain(
      'Install the assigned runtime',
    );
    expect(prerequisiteReads).toBe(1);
    expect(board.get<ChatRequest>('chat_request', request.id).deliveries[0].status).toBe('queued');
  } finally {
    board.close();
  }
});
