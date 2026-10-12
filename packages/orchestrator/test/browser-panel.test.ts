import {
  defaultCapabilities,
  type AgentTask,
  type Conversation,
  type Role,
  type Run,
} from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, setup, resources, finish } from './helpers/daemon.ts';

afterEach(async () => {
  for (const { daemon } of resources) daemon.service.controllers.delete('browser-panel-run');
  await cleanup();
});
async function fixture(port: number) {
  const driver = {
    snapshot: vi.fn(async () => ({
      url: 'https://8.8.8.8/application',
      title: 'Fictional application',
      text: 'Name Submit',
      screenshot: '',
      digest: 'fixture',
    })),
    frame: vi.fn(async () => ({
      url: 'https://8.8.8.8/application',
      title: 'Fictional application',
      screenshot: 'fixture-jpeg',
      width: 1280,
      height: 800,
    })),
    resize: vi.fn(async () => true),
    perform: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    input: vi.fn(async () => {}),
  };
  const fixture = await setup(port, false, { browserLaunch: async () => driver });
  const service = fixture.daemon.service;
  const role = service.board.get<Role>('role', 'writer');
  service.board.record(
    'role',
    {
      ...role,
      browserMode: 'autonomous',
      capabilities: { ...defaultCapabilities, ...role.capabilities, computerUse: true },
    },
    'user',
    'Enable fixture browser',
  );

  const conversation = service.board
    .list<Conversation>('conversation')
    .find((item) => item.id === 'writer')!;
  const run: Run = {
    id: 'browser-panel-run',
    cardId: null,
    roleId: 'writer',
    runtime: 'demo',
    threadId: conversation.id,
    mode: 'chat',
    status: 'running',
    message: '',
    startedAt: '',
    finishedAt: null,
  };
  service.board.record('run', run, 'user', 'Fixture browser run');
  service.controllers.set(run.id, new AbortController());
  service.capabilities.set('browser-fixture-token', {
    runId: run.id,
    roleId: run.roleId,
    cardId: null,
  });
  await service.agentCall('browser-fixture-token', 'computer_inspect', {});
  return { ...fixture, service, driver, run };
}
it('protects browser frames, manual input and task permissions with the user session and conversation membership', async () => {
  const { daemon, request, cookie, service, driver, run } = await fixture(14516);
  const path = '/browser/writer/control?threadId=writer';
  const denied = await fetch(`${daemon.url}/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer browser-fixture-token' },
    body: JSON.stringify({ operation: 'take' }),
  });
  expect(denied.status).toBe(403);
  expect((await request('/browser/writer/open?threadId=scout', 'POST')).response.status).toBe(400);
  const takeover = await request<{ leaseId: string }>(path, 'POST', { operation: 'take' });
  expect(takeover.response.status).toBe(200);
  const leaseId = takeover.result.leaseId;
  expect(
    (
      await request('/browser/writer/input?threadId=writer', 'POST', {
        leaseId,
        input: { kind: 'text', text: 'private credential' },
      })
    ).response.status,
  ).toBe(200);
  expect(driver.input).toHaveBeenCalledWith({ kind: 'text', text: 'private credential' });
  expect(JSON.stringify(service.board.events())).not.toContain('private credential');
  await request(path, 'POST', { operation: 'release', leaseId });
  const controller = new AbortController();
  const stream = await fetch(`${daemon.url}/api/browser/writer/stream?threadId=writer`, {
    signal: controller.signal,
    headers: { cookie, 'x-pitchcrew-client': 'ui' },
  });
  expect(stream.status).toBe(200);
  expect(stream.headers.get('cache-control')).toBe('no-store');
  const reader = stream.body!.getReader();
  const frame = await reader.read();
  expect(new TextDecoder().decode(frame.value)).toContain('fixture-jpeg');
  controller.abort();
  await reader.cancel().catch(() => {});
  const approval = (
    await service.agentCall('browser-fixture-token', 'computer_request', {
      input: { kind: 'navigate', url: 'https://8.8.8.8/application' },
      reason: 'Open fictional form',
    })
  ).approval as { id: string };
  expect(
    (
      await request('/browser/writer/sites?threadId=writer', 'POST', {
        taskId: run.id,
        url: 'http://127.0.0.1:4417',
      })
    ).response.status,
  ).toBe(400);
  expect(
    (
      await request('/browser/writer/sites?threadId=writer', 'POST', {
        taskId: 'other-task',
        url: 'https://8.8.8.8/',
      })
    ).response.status,
  ).toBe(400);
  expect(
    (
      await request('/browser/writer/sites?threadId=writer', 'POST', {
        taskId: run.id,
        url: 'https://8.8.8.8/application',
        approvalId: approval.id,
      })
    ).response.status,
  ).toBe(200);
  expect(service.computer.browsers.list()[0].allowedSites).toEqual(['https://8.8.8.8']);
  expect((await request('/browser/writer/close?threadId=writer', 'POST')).response.status).toBe(
    200,
  );
  expect(driver.close).toHaveBeenCalledOnce();
  expect(service.controllers.get(run.id)?.signal.aborted).toBe(true);
});
it('keeps scheduled routines supervised and applies conversation browser overrides only to future runs', async () => {
  const { service, run } = await fixture(14517);
  await service.computer.stop(run.id);
  service.board.record(
    'run',
    { ...run, id: 'routine-browser', routineId: 'fictional-routine' },
    'user',
    'Routine fixture',
  );
  service.capabilities.set('routine-token', {
    runId: 'routine-browser',
    roleId: 'writer',
    cardId: null,
  });
  await service.agentCall('routine-token', 'computer_inspect', {});
  expect(service.computer.browsers.list()[0].mode).toBe('supervised');
  await service.computer.stop('routine-browser');
  const current = service.board.get<Role>('role', 'writer');
  service.board.record(
    'run',
    {
      ...run,
      id: 'captured-browser',
      configuration: {
        role: { ...current, browserMode: 'supervised' },
        revision: '',
        skills: [],
        skillsRevision: '',
      },
    },
    'user',
    'Captured configuration fixture',
  );
  service.capabilities.set('captured-token', {
    runId: 'captured-browser',
    roleId: 'writer',
    cardId: null,
  });
  const conversation = service.board.get<Conversation>('conversation', 'writer');
  service.board.record(
    'conversation',
    { ...conversation, configurations: { writer: { browserMode: 'autonomous' } } },
    'user',
    'Change next turn mode',
  );
  await service.agentCall('captured-token', 'computer_inspect', {});
  expect(service.computer.browsers.list()[0].mode).toBe('supervised');
});

it('captures the originating conversation browser mode for a workflow follow-up', async () => {
  const { service, run, request } = await fixture(14518);
  service.board.record('run', { ...run, status: 'completed' }, 'user', 'Completed parent fixture');
  service.controllers.delete(run.id);
  await service.computer.stop(run.id);
  await service.saveProfile('fictional.md', 'I am a fictional software engineer.');
  const card = service.createCard({
    company: 'Fictional Company',
    title: 'Engineer',
    description: 'Fictional engineering role',
    url: 'https://8.8.8.8/application',
  });
  const role = service.board.get<Role>('role', 'scout');
  service.board.record(
    'role',
    { ...role, browserMode: 'autonomous' },
    'user',
    'Autonomous default fixture',
  );
  const conversation = service.createConversation({
    title: 'Browser mode fixture',
    participants: ['scout', 'writer'],
    leadId: 'writer',
    cardId: card.id,
  });
  await service.updateConversation(conversation.id, {
    configurations: { scout: { browserMode: 'supervised' } },
  });
  const task: AgentTask = {
    id: 'browser-workflow-task',
    parentRunId: run.id,
    rootRunId: run.id,
    roleId: 'scout',
    cardId: card.id,
    mode: 'workflow',
    trigger: 'invoke',
    threadId: conversation.id,
    content: 'Assess this fictional role',
    status: 'queued',
    runId: null,
    error: '',
    createdAt: new Date().toISOString(),
  };
  service.board.record('task', task, 'writer', 'Queued fixture follow-up');
  const launched = await service.startRun(card.id, 'scout', task);
  expect(launched.configuration?.role.browserMode).toBe('supervised');
  await finish(request, launched.id);
});

it('lets users choose browser permissions without installing or changing a runtime', async () => {
  const { daemon, request } = await setup(14519);
  for (const runtime of daemon.service.runtimes) runtime.available = false;
  const changed = await request<Conversation>('/conversations/writer', 'PUT', {
    configurations: { writer: { browserMode: 'autonomous' } },
  });
  expect(changed.response.status).toBe(200);
  expect(changed.result.configurations.writer).toEqual({ browserMode: 'autonomous' });
});

it('bounds viewport resizing and allows only the manual controller while protecting approval evidence', async () => {
  const { request, driver, service } = await fixture(14520);
  const path = '/browser/writer/viewport?threadId=writer';
  const viewport = { width: 390, height: 920 };
  expect((await request(path, 'POST', viewport)).result).toEqual({ applied: true });
  expect(driver.resize).toHaveBeenCalledWith(viewport);
  expect(
    (await request('/browser/writer/viewport?threadId=scout', 'POST', viewport)).response.status,
  ).toBe(400);
  for (const size of [
    { width: 0, height: 920 },
    { width: 99999, height: 920 },
    { width: 390.5, height: 920 },
  ])
    expect((await request(path, 'POST', size)).response.status).toBe(400);
  const takeover = await request<{ leaseId: string }>(
    '/browser/writer/control?threadId=writer',
    'POST',
    { operation: 'take' },
  );
  expect((await request(path, 'POST', viewport)).result).toEqual({ applied: false });
  expect(
    (await request(path, 'POST', { ...viewport, leaseId: takeover.result.leaseId })).result,
  ).toEqual({ applied: true });
  await request('/browser/writer/control?threadId=writer', 'POST', {
    operation: 'release',
    leaseId: takeover.result.leaseId,
  });
  const approval = await service.computer.request(
    { runId: 'browser-panel-run', roleId: 'writer', cardId: null },
    { kind: 'navigate', url: 'https://8.8.8.8/application' },
    'Open fictional form',
  );
  driver.resize.mockClear();
  expect((await request(path, 'POST', viewport)).result).toEqual({ applied: false });
  service.computer.decide(approval.id, true);
  expect((await request(path, 'POST', viewport)).result).toEqual({ applied: false });
  expect(driver.resize).not.toHaveBeenCalled();
});
