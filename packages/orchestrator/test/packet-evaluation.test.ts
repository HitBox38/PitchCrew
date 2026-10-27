import { adapters } from '@pitchcrew/adapters';
import {
  states,
  runResultSchema,
  type Approval,
  type Card,
  type ChatRequest,
  type ChatMessage,
} from '@pitchcrew/core';
import {
  digestPacket,
  jobSourceRevision,
  saveApplicationContext,
  updateJobDetails,
} from '@pitchcrew/board';
import { afterEach, expect, it, vi } from 'vitest';
import { promptFor } from '../../adapters/src/process.ts';
import { packet } from '../../board/test/fixtures/packet.ts';
import { reviewFixturePacket } from '../../board/test/fixtures/application-context.ts';
import { cleanup, setup, waitForSnapshot } from './helpers/daemon.ts';

const evaluation = {
  role: 'scout' as const,
  fit: 84,
  reasons: ['The Profile supports React experience.'],
  packetFit: {
    score: 73,
    reasons: ['The letter needs stronger evidence for the job requirements.'],
  },
};
afterEach(cleanup);
const fixture = async (port: number) => {
  const host = await setup(port);
  await host.daemon.service.saveProfile(
    'experience.md',
    '# Experience\n\n- Built React interfaces.',
  );
  const card = host.daemon.service.createCard({
    company: 'Fictional packet review',
    title: 'Engineer',
    description: 'RAW-SOURCE-EXCLUDED',
  });
  host.daemon.service.board.updateCard(
    card.id,
    { packet, feedback: ['Keep saved review feedback.'] },
    'writer',
    'Fixture packet',
  );
  const current = reviewFixturePacket(host.daemon.service.board, card.id);
  return { ...host, card: current };
};
const enqueue = async (host: Awaited<ReturnType<typeof fixture>>) => {
  const response = await host.request<ChatRequest>('/queue/actions', 'POST', {
    cardId: host.card.id,
    action: 'reevaluate',
    roleId: 'scout',
  });
  expect(response.response.status).toBe(202);
  return response.result;
};
const settled = async (host: Awaited<ReturnType<typeof fixture>>, id: string) => {
  return waitForSnapshot(
    host.request,
    (snapshot) =>
      snapshot.runs.some(
        (run) =>
          run.requestId === id &&
          ['completed', 'failed', 'cancelled', 'waiting'].includes(run.status),
      ) && !snapshot.cards.find((card) => card.id === host.card.id)?.owner,
  );
};

it('reevaluates the whole packet at every job stage without changing workflow feedback, review or approval', async () => {
  const host = await fixture(24651);
  const board = host.daemon.service.board;
  const checked: string[] = [];
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    expect(context.purpose).toBe('packet-evaluation');
    expect(context.card.packet).toEqual(packet);
    expect(context.card.feedback).toEqual([]);
    expect(context.card.description).toBe('');
    const prompt = promptFor(context);
    expect(prompt).toContain('"packetFit"');
    expect(prompt).not.toContain('RAW-SOURCE-EXCLUDED');
    for (const text of Object.values(packet).filter((value) => typeof value === 'string'))
      expect(prompt).toContain(JSON.stringify(text));
    const token = context.mcp.env.PITCHCREW_RUN_TOKEN;
    expect((await host.daemon.service.agentCall(token, 'card', {})).card).toEqual(context.card);
    for (const action of ['history', 'export', 'workflow', 'connector', 'quality', 'invoke'])
      await expect(host.daemon.service.agentCall(token, action, {})).rejects.toThrow(
        'isolated application',
      );
    checked.push(context.card.state);
    return evaluation;
  });
  for (const state of states) {
    board.record(
      'card',
      { ...board.get<Card>('card', host.card.id), state },
      'user',
      'Fixture stage',
    );
    const before = board.get<Card>('card', host.card.id);
    const request = await enqueue(host);
    const snapshot = await settled(host, request.id);
    const run = snapshot.runs.find((run) => run.requestId === request.id)!;
    expect(run.status, run.message).toBe('completed');
    expect(
      board.list<ChatMessage>('message').find((message) => message.runId === run.id)?.content,
    ).toContain('73/100 packet match and 84/100 candidate fit');
    expect(board.get<Card>('card', host.card.id)).toMatchObject({
      state,
      owner: null,
      packet,
      feedback: before.feedback,
      packetReview: before.packetReview,
      fit: 84,
      packetFit: {
        score: 73,
        packetDigest: digestPacket(host.card.id, packet),
        contextRevision: before.applicationContext!.revision,
        runId: run.id,
      },
    });
  }
  expect(checked).toEqual(states);
  board.record(
    'card',
    { ...board.get<Card>('card', host.card.id), state: 'agreed' },
    'user',
    'Fixture reviewed',
  );
  const approval = board.requestApproval(host.card.id);
  board.decideApproval(approval.id, true);
  const beforeApproval = board.get<Approval>('approval', approval.id);
  const request = await enqueue(host);
  await settled(host, request.id);
  expect(board.get<Approval>('approval', approval.id)).toEqual(beforeApproval);
  const beforeReplay = board.get<Card>('card', host.card.id);
  board.rebuild();
  expect(board.get<Card>('card', host.card.id)).toEqual(beforeReplay);
});

it('clears the rating on packet, adopted brief and job-source changes, retaining old event evidence', async () => {
  const host = await fixture(24652);
  const board = host.daemon.service.board;
  vi.spyOn(adapters.demo, 'run').mockResolvedValue(evaluation);
  const request = await enqueue(host);
  await settled(host, request.id);
  const rated = board.get<Card>('card', host.card.id);
  board.updateCard(
    host.card.id,
    { packet: { ...packet, note: 'Updated application note.' } },
    'writer',
    'Changed packet',
  );
  expect(board.get<Card>('card', host.card.id).packetFit).toBeUndefined();
  board.record('card', rated, 'user', 'Restore fictional fixture');
  saveApplicationContext(
    board,
    rated.id,
    jobSourceRevision(rated),
    rated.applicationContext!.revision,
    {
      brief: {
        ...rated.applicationContext!.brief,
        responsibilities: ['Build accessible interfaces.'],
      },
      requirements: [],
      flagged: [],
    },
    true,
  );
  expect(board.get<Card>('card', rated.id).packetFit).toBeUndefined();
  expect(
    board.history(rated.id).some((event) => (event.data as Card).packetFit?.score === 73),
  ).toBe(true);
  board.rebuild();
  expect(board.get<Card>('card', rated.id).packetFit).toBeUndefined();
  board.record('card', rated, 'user', 'Restore fictional fixture');
  updateJobDetails(
    board,
    rated.id,
    { title: 'Senior Engineer' },
    'user',
    'fictional-chat',
    'Changed title',
  );
  expect(board.get<Card>('card', rated.id).packetFit).toBeUndefined();
});

it('rejects missing and invalid scores and discards results when the packet changes during evaluation', async () => {
  const host = await fixture(24653);
  const board = host.daemon.service.board;
  for (const score of [-1, 101, 2.5])
    expect(
      runResultSchema.safeParse({ ...evaluation, packetFit: { score, reasons: ['Reason'] } })
        .success,
    ).toBe(false);
  vi.spyOn(adapters.demo, 'run').mockImplementation(async () => {
    board.updateCard(
      host.card.id,
      { packet: { ...packet, note: 'Changed mid-run' } },
      'writer',
      'Fixture race',
    );
    return evaluation;
  });
  const request = await enqueue(host);
  const snapshot = await settled(host, request.id);
  expect(snapshot.runs.find((run) => run.requestId === request.id)).toMatchObject({
    status: 'failed',
    message: expect.stringContaining('packet or job brief changed'),
  });
  expect(board.get<Card>('card', host.card.id)).toMatchObject({
    state: 'lead',
    feedback: host.card.feedback,
  });
  expect(board.get<Card>('card', host.card.id).packetFit).toBeUndefined();
});

it('requires a rating even when a provider returns a valid ordinary fit result', async () => {
  const host = await fixture(24654);
  host.daemon.service.board.record(
    'card',
    { ...host.card, state: 'drafting' },
    'user',
    'Fixture stage',
  );
  vi.spyOn(adapters.demo, 'run').mockResolvedValue({ role: 'scout', fit: 88, reasons: [] });
  const request = await enqueue(host);
  const snapshot = await settled(host, request.id);
  expect(snapshot.runs.find((run) => run.requestId === request.id)).toMatchObject({
    status: 'failed',
    message: expect.stringContaining('packet-to-job rating'),
  });
  expect(host.daemon.service.board.get<Card>('card', host.card.id).state).toBe('drafting');
});

it('cancels a reevaluation without changing a drafting-stage job or its saved review', async () => {
  const host = await fixture(24655);
  const board = host.daemon.service.board;
  board.record('card', { ...host.card, state: 'drafting' }, 'user', 'Fixture stage');
  vi.spyOn(adapters.demo, 'run').mockImplementation(
    (context) =>
      new Promise((_resolve, reject) => {
        context.signal.addEventListener('abort', () => reject(new Error('Cancelled')), {
          once: true,
        });
      }),
  );
  const request = await enqueue(host);
  const running = await waitForSnapshot(host.request, (snapshot) =>
    snapshot.runs.some((run) => run.requestId === request.id && run.status === 'running'),
  );
  const run = running.runs.find((run) => run.requestId === request.id)!;
  await host.request(`/runs/${run.id}/cancel`, 'POST');
  const snapshot = await settled(host, request.id);
  expect(snapshot.runs.find((item) => item.id === run.id)?.status).toBe('cancelled');
  expect(board.get<Card>('card', host.card.id)).toMatchObject({
    state: 'drafting',
    packet,
    feedback: host.card.feedback,
    packetReview: host.card.packetReview,
  });
});

it('resumes an evaluation question with the same isolated purpose and saved user answer', async () => {
  const host = await fixture(24656);
  const run = vi
    .spyOn(adapters.demo, 'run')
    .mockImplementationOnce(async (context) => {
      await host.daemon.service.agentCall(context.mcp.env.PITCHCREW_RUN_TOKEN, 'ask_user', {
        question: 'Which evidence should the assessment emphasize?',
        reason: 'Clarify the user’s priorities.',
      });
      return evaluation;
    })
    .mockImplementationOnce(async (context) => {
      expect(context.purpose).toBe('packet-evaluation');
      expect(context.card.packet).toEqual(packet);
      expect(context.userAnswers?.at(-1)?.answer).toBe('Accessibility.');
      return evaluation;
    });
  const request = await enqueue(host);
  const snapshot = await settled(host, request.id);
  const question = snapshot.userInputs!.find((question) => question.cardId === host.card.id)!;
  expect(question.status).toBe('pending');
  const answer = await host.request<ChatRequest>(`/user-input/${question.id}/answer`, 'POST', {
    text: 'Accessibility.',
  });
  expect(answer.response.status).toBe(202);
  const finished = await settled(host, answer.result.id);
  expect(finished.runs.find((run) => run.requestId === answer.result.id)?.status).toBe('completed');
  expect(run).toHaveBeenCalledTimes(2);
  expect(host.daemon.service.board.get<Card>('card', host.card.id)).toMatchObject({
    state: 'lead',
    packetFit: { score: 73 },
  });
});
