import { adapters } from '@pitchcrew/adapters';
import type { ChatContext, Run, RunContext, ConversationHistoryPage } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, confirmFixtureApplication, finish, setup } from './helpers/daemon.ts';
afterEach(cleanup);

it('streams, sanitizes and saves an ordinary board workflow turn in its job conversation', async () => {
  let context!: RunContext;
  let complete!: () => void;
  vi.spyOn(adapters.demo, 'run').mockImplementation((turn) => {
    context = turn;
    return new Promise((resolve) => {
      complete = () => resolve({ role: 'scout', fit: 82, reasons: ['Fictional fit'] });
    });
  });
  const { daemon, request } = await setup(14632);
  await daemon.service.saveProfile('experience.md', '# Experience\n\nBuilt fictional interfaces.');
  const card = daemon.service.createCard({
    company: 'Fictional Studio',
    title: 'Engineer',
    description: 'Build interfaces.',
  });
  await confirmFixtureApplication(request, card.id);
  const { result: run } = await request<Run>(`/cards/${card.id}/run`, 'POST', { roleId: 'scout' });
  await vi.waitFor(() => expect(context).toBeDefined());
  context.onActivity!({
    id: 'note',
    kind: 'commentary',
    label: 'Update',
    text: 'Comparing the confirmed brief.',
    status: 'completed',
  });
  context.onActivity!({
    id: 'tool',
    kind: 'tool',
    label: 'Reading profile',
    text: 'PRIVATE TOOL INPUT',
    status: 'running',
  });
  const live = daemon.service.chatState().activityRuns!.find((item) => item.id === run.id)!;
  expect(live.threadId).toBeTruthy();
  expect(live.configuration).toBeUndefined();
  expect(JSON.stringify(live.activity)).not.toContain('PRIVATE');
  expect(live.activity).toContainEqual(
    expect.objectContaining({ text: 'Comparing the confirmed brief.' }),
  );
  const history = await request<ConversationHistoryPage>(
    `/conversations/${run.threadId}/history?anchor=turn-${run.id}`,
  );
  expect(history.result.items).toContainEqual(
    expect.objectContaining({ kind: 'turn', id: `turn-${run.id}` }),
  );
  complete();
  await finish(request, run.id);
  await vi.waitFor(() =>
    expect(daemon.service.board.get<Run>('run', run.id).activity).toBeDefined(),
  );
  const saved = await request<ConversationHistoryPage>(`/conversations/${run.threadId}/history`);
  expect(JSON.stringify(saved.result.items)).toContain('Comparing the confirmed brief.');
  expect(JSON.stringify(saved.result.items)).not.toContain('PRIVATE');
});
it('gives source extraction a job conversation and retains its public progress', async () => {
  let context!: ChatContext;
  let complete!: () => void;
  vi.spyOn(adapters.demo, 'chat').mockImplementation((turn) => {
    context = turn;
    return new Promise((resolve) => {
      complete = () =>
        resolve({
          reply: JSON.stringify({
            brief: {
              companyContext: 'Fictional employer.',
              responsibilities: ['Build interfaces.'],
              qualifications: [],
              constraints: [],
            },
            requirements: [],
            flagged: [],
          }),
        });
    });
  });
  const { daemon, request } = await setup(14633);
  const card = daemon.service.createCard({
    company: 'Fictional Source',
    title: 'Engineer',
    description: 'Build interfaces.',
  });
  const { result: run } = await request<Run>(
    `/cards/${card.id}/application-context/extract`,
    'POST',
    { roleId: 'scout' },
  );
  await vi.waitFor(() => expect(context).toBeDefined());
  expect(run.threadId).toBeTruthy();
  expect(daemon.service.board.get('conversation', run.threadId!)).toMatchObject({
    kind: 'application',
    cardId: card.id,
  });
  context.onActivity!({
    id: 'note',
    kind: 'commentary',
    label: 'Update',
    text: 'Extracting employer requirements.',
    status: 'completed',
  });
  complete();
  await finish(request, run.id);
  await vi.waitFor(() =>
    expect(daemon.service.board.get<Run>('run', run.id).activity).toBeDefined(),
  );
  expect(daemon.service.board.get<Run>('run', run.id).activity).toContainEqual(
    expect.objectContaining({ text: 'Extracting employer requirements.' }),
  );
});
