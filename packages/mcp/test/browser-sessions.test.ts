import { Board } from '@pitchcrew/board';
import type { BrowserSnapshot, ComputerApproval, BrowserSitePermission } from '@pitchcrew/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it, vi } from 'vitest';
import { ComputerManager } from '../src/computer.ts';
import { BrowserSessions } from '../src/computer/sessions.ts';
const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-browser-sessions-'));
  const board = new Board(join(directory, 'board.db'));
  const page: BrowserSnapshot = {
    url: 'https://jobs.lever.co/fictional/apply',
    title: 'Fictional form',
    text: 'Name Apply',
    screenshot: '',
    digest: 'fixture-page',
  };
  const drivers: {
    snapshot: ReturnType<typeof vi.fn>;
    perform: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    freshPage: ReturnType<typeof vi.fn>;
    input: ReturnType<typeof vi.fn>;
    automatic: ReturnType<typeof vi.fn>;
  }[] = [];
  const launch = vi.fn(async (_profile?: string) => {
    const driver = {
      snapshot: vi.fn(async () => ({ ...page })),
      perform: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      freshPage: vi.fn(async () => {}),
      input: vi.fn(async () => {}),
      automatic: vi.fn(async () => true),
    };
    drivers.push(driver);
    return driver;
  });
  const manager = new ComputerManager(board, directory, launch);
  resources.push(async () => {
    await manager.close();
    board.close();
    await rm(directory, { recursive: true, force: true });
  });
  const scope = { runId: 'run-one', roleId: 'writer', cardId: null };
  manager.browsers.bind({
    ...scope,
    threadId: 'first-chat',
    taskId: 'user-task',
    mode: 'autonomous',
  });
  return { manager, board, directory, launch, drivers, scope, page };
};

const resources: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of resources.splice(0)) await cleanup();
  vi.useRealTimers();
});
it('keeps profiles and sign-in ownership per agent and starts fresh pages for other contexts', async () => {
  const { manager, scope, launch, drivers, directory } = await fixture();
  await manager.inspect(scope.runId);
  manager.browsers.bind({
    runId: 'scout-run',
    roleId: 'scout',
    threadId: 'first-chat',
    cardId: null,
  });
  await manager.inspect('scout-run');
  expect(launch.mock.calls.map(([path]) => path)).toEqual([
    join(directory, 'browser-profiles', 'writer'),
    join(directory, 'browser-profiles', 'scout'),
  ]);
  await manager.stop(scope.runId);
  expect(drivers[0].close).not.toHaveBeenCalled();
  manager.browsers.bind({
    ...scope,
    runId: 'run-two',
    threadId: 'first-chat',
    taskId: 'user-task',
  });
  await manager.inspect('run-two');
  expect(launch).toHaveBeenCalledTimes(2);
  expect(drivers[0].freshPage).not.toHaveBeenCalled();
  await manager.stop('run-two');
  manager.browsers.bind({ ...scope, runId: 'run-three', threadId: 'different-chat' });
  await manager.inspect('run-three');
  expect(launch).toHaveBeenCalledTimes(3);
  expect(drivers[0].freshPage).not.toHaveBeenCalled();
  await expect(manager.inspect(scope.runId)).rejects.toThrow('ended');
});
it('pauses observation during takeover, invalidates approvals and requires the exact controller lease', async () => {
  const { manager, board, scope, drivers } = await fixture();
  const approval = await manager.request(scope, { kind: 'click', selector: '#submit' }, 'Submit');
  const lease = manager.takeControl('writer');
  expect(board.get<ComputerApproval>('computer_approval', approval.id).status).toBe('rejected');
  const inspected = drivers[0].snapshot.mock.calls.length;
  await expect(manager.inspect(scope.runId)).rejects.toThrow('Manual control');
  expect(drivers[0].snapshot).toHaveBeenCalledTimes(inspected);
  await expect(
    manager.manualInput('writer', 'wrong-lease', { kind: 'text', text: 'secret' }),
  ).rejects.toThrow('expired');
  await manager.manualInput('writer', lease, { kind: 'text', text: 'secret' });
  expect(drivers[0].input).toHaveBeenCalledWith({ kind: 'text', text: 'secret' });
  expect(JSON.stringify(board.events())).not.toContain('secret');
  manager.browsers.release('writer', lease);
  await manager.inspect(scope.runId);
  expect(drivers[0].snapshot).toHaveBeenCalledTimes(inspected + 1);
});
it('discards a snapshot captured across a manual takeover', async () => {
  const { manager, scope, drivers, page } = await fixture();
  await manager.inspect(scope.runId);
  let finish!: (value: BrowserSnapshot) => void;
  drivers[0].snapshot.mockImplementationOnce(
    () =>
      new Promise<BrowserSnapshot>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = manager.inspect(scope.runId);
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  manager.takeControl('writer');
  finish({ ...page, text: 'private login' });
  await expect(pending).rejects.toThrow('Manual control');
});
it('requires task site access, rechecks preparation rules, and never auto-approves submission controls', async () => {
  const { manager, board, scope, drivers } = await fixture();
  const navigation = await manager.request(
    scope,
    { kind: 'navigate', url: 'https://jobs.lever.co/fictional/apply' },
    'Open application',
  );
  expect(navigation.status).toBe('pending');
  manager.allowSite('writer', 'user-task', 'https://jobs.lever.co', true, navigation.id);
  await manager.execute(scope.runId, navigation.id, new AbortController().signal, () => {}, 0);
  const prepared = await manager.request(
    scope,
    { kind: 'fill', selector: '#name', value: 'Fictional Person' },
    'Prepare name',
  );
  expect(prepared).toMatchObject({ status: 'approved', automatic: true });
  drivers[0].automatic.mockResolvedValueOnce(false);
  await expect(
    manager.execute(scope.runId, prepared.id, new AbortController().signal, () => {}, 0),
  ).rejects.toThrow('permission changed');
  drivers[0].automatic.mockResolvedValue(false);
  const submit = await manager.request(
    scope,
    { kind: 'click', selector: '#submit' },
    'Submit application',
  );
  expect(submit.status).toBe('pending');
  expect(board.list<BrowserSitePermission>('browser_site_permission')).toMatchObject([
    { roleId: 'writer', taskId: 'user-task', allowed: true },
  ]);
  board.rebuild();
  expect(board.get<ComputerApproval>('computer_approval', submit.id).status).toBe('pending');
  await manager.stop(scope.runId);
  manager.browsers.bind({
    ...scope,
    runId: 'another-request',
    taskId: 'different-task',
    threadId: 'first-chat',
    mode: 'autonomous',
  });
  expect(manager.browsers.list()[0].allowedSites).toEqual([]);
});
it('expires controller leases without silently returning observation to the agent', async () => {
  const { manager, scope } = await fixture();
  await manager.inspect(scope.runId);
  vi.useFakeTimers();
  const lease = manager.takeControl('writer');
  await vi.advanceTimersByTimeAsync(45_001);
  expect(() => manager.browsers.release('writer', lease)).toThrow('expired');
  await expect(manager.inspect(scope.runId)).rejects.toThrow('Manual control');
  const replacement = manager.takeControl('writer');
  manager.browsers.release('writer', replacement);
  expect(manager.browsers.list()[0].manual).toBe(false);
});
it('closes idle browsers and opens the same profile again', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-browser-idle-'));
  const close = vi.fn(async () => {});
  const launch = vi.fn(async () => ({ snapshot: vi.fn(), perform: vi.fn(), close }));
  const sessions = new BrowserSessions(directory, launch, 1000);
  resources.push(async () => {
    await sessions.close();
    await rm(directory, { recursive: true, force: true });
  });
  vi.useFakeTimers();
  sessions.bind({ runId: 'idle-run', roleId: 'writer', cardId: null });
  await sessions.driver('idle-run');
  sessions.stop('idle-run');
  await vi.advanceTimersByTimeAsync(1001);
  expect(close).toHaveBeenCalledOnce();
  await sessions.openRole('writer', 'chat', null);
  expect(launch).toHaveBeenCalledTimes(2);
});

it('does not hand off an agent browser while an ended run is still finishing an action', async () => {
  const { manager, scope, drivers } = await fixture();
  const approval = await manager.request(scope, { kind: 'click', selector: '#next' }, 'Next');
  manager.decide(approval.id, true);
  let finish!: () => void;
  drivers[0].perform.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = manager.execute(
    scope.runId,
    approval.id,
    new AbortController().signal,
    () => {},
    0,
  );
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  await manager.stop(scope.runId);
  expect(() => manager.takeControl('writer')).toThrow('in progress');
  expect(() => manager.bindBrowser({ ...scope, runId: 'next-run' })).toThrow('still finishing');
  finish();
  await expect(pending).rejects.toThrow('ended');
  const lease = manager.takeControl('writer');
  await manager.returnControl('writer', lease);
});

it('isolates parallel job tabs and manual leases while sharing the agent profile', async () => {
  const { manager, scope, drivers } = await fixture();
  await manager.inspect(scope.runId);
  const tab = {
    ...drivers[0],
    snapshot: vi.fn(async () => ({
      url: 'https://example.com/b',
      title: 'Job B',
      text: 'Job B',
      digest: 'b',
      screenshot: '',
    })),
    close: vi.fn(async () => {}),
  };
  const newTab = vi.fn(async () => tab);
  Object.assign(drivers[0], { newTab });
  manager.bindBrowser({ runId: 'job-b', roleId: 'writer', cardId: 'job-b', threadId: 'chat-b' });
  await manager.inspect('job-b');
  expect(newTab).toHaveBeenCalledOnce();
  const firstKey = manager.browsers.key('writer', 'first-chat', null);
  const secondKey = manager.browsers.key('writer', 'chat-b', 'job-b');
  const lease = manager.takeControl(firstKey);
  await expect(manager.inspect(scope.runId)).rejects.toThrow('Manual control');
  expect((await manager.inspect('job-b')).title).toBe('Job B');
  expect(() => manager.browsers.lease(secondKey, lease)).toThrow('expired');
  await manager.returnControl(firstKey, lease);
  await manager.browsers.closeRole(firstKey);
  expect(tab.close).not.toHaveBeenCalled();
});
