import { defaultCapabilities, type Role, type ComputerApproval } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { setup, cleanup } from './helpers/daemon.ts';

const identity = {
  id: 'fdebb1e8-41d2-4e34-89c8-e50259ae47ab',
  ownerId: '82c426cd-12d2-480e-acd3-dab28bd2fe71',
};
const fixture = async () => {
  const setManual = vi.fn(async (_manual: boolean) => {});
  const nativeCommand = vi.fn(async () => ({ ...identity, activeTab: 'tab', tabs: [] }));
  let closed = () => {};
  const driver = {
    native: identity,
    setManual,
    nativeCommand,
    nativeState: async () => ({ ...identity, activeTab: 'tab', tabs: [] }),
    onClosed: (receive: () => void) => {
      closed = receive;
      return () => {};
    },
    getViewport: () => ({ width: 1280, height: 800 }),
    resize: vi.fn(async () => true),
    snapshot: async () => ({
      url: 'https://example.com',
      title: 'Fixture',
      text: 'Fixture',
      screenshot: '',
      digest: 'page',
    }),
    perform: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  const host = await setup(false, { browserLaunch: async () => driver });
  const service = host.daemon.service;
  const role = service.board.get<Role>('role', 'writer');
  service.board.record(
    'role',
    { ...role, capabilities: { ...defaultCapabilities, ...role.capabilities, computerUse: true } },
    'user',
    'Enable native fixture',
  );
  await service.computer.openBrowser('writer', 'writer', null);
  return { ...host, service, driver, close: () => closed() };
};
afterEach(cleanup);
it('uses the user session and manual lease for native commands and synchronizes private control', async () => {
  const { request, driver } = await fixture();
  expect((await request('/browser/writer/native?threadId=writer')).result).toMatchObject(identity);
  expect((await request('/browser/writer/native?threadId=scout')).response.status).toBe(400);
  expect(
    (
      await request('/browser/writer/native?threadId=writer', 'POST', {
        leaseId: identity.id,
        command: { kind: 'new-tab' },
      })
    ).response.status,
  ).toBe(400);
  const take = await request<{ leaseId: string }>(
    '/browser/writer/control?threadId=writer',
    'POST',
    { operation: 'take' },
  );
  expect(driver.setManual).toHaveBeenLastCalledWith(true);
  const result = await request('/browser/writer/native?threadId=writer', 'POST', {
    leaseId: take.result.leaseId,
    command: { kind: 'new-tab' },
  });
  expect(result.response.status).toBe(200);
  expect(driver.nativeCommand).toHaveBeenLastCalledWith({ kind: 'new-tab' });
  await request('/browser/writer/control?threadId=writer', 'POST', {
    operation: 'release',
    leaseId: take.result.leaseId,
  });
  expect(driver.setManual).toHaveBeenLastCalledWith(false);
});
it('keeps a failed native control recovery private and permits another recovery attempt', async () => {
  const { service, request, driver } = await fixture();
  const scope = { runId: 'private-recovery-run', roleId: 'writer', cardId: null };
  service.computer.bindBrowser({ ...scope, threadId: 'writer' });
  const path = '/browser/writer/control?threadId=writer';
  const initial = await request<{ leaseId: string }>(path, 'POST', { operation: 'take' });
  const session = service.computer.browsers.forRole('writer');
  session.lease!.until = Date.now() - 1;
  driver.setManual.mockRejectedValueOnce(
    new DOMException('Native sync timed out.', 'TimeoutError'),
  );
  expect((await request(path, 'POST', { operation: 'take' })).response.status).toBe(400);
  expect(session.info.manual).toBe(true);
  expect(session.lease).toBeUndefined();
  await expect(service.computer.inspect(scope.runId)).rejects.toThrow('Manual control');
  expect(driver.setManual.mock.calls.every(([manual]) => manual)).toBe(true);
  const recovered = await request<{ leaseId: string }>(path, 'POST', { operation: 'take' });
  expect(recovered.response.status).toBe(200);
  expect(recovered.result.leaseId).not.toBe(initial.result.leaseId);
  await request(path, 'POST', { operation: 'release', leaseId: recovered.result.leaseId });
  expect(session.info.manual).toBe(false);
});
it('expires unused approvals on native reflow and terminates browser access after host loss', async () => {
  const { service, request, driver, close } = await fixture();
  const scope = { runId: 'native-run', roleId: 'writer', cardId: null };
  service.computer.bindBrowser({ ...scope, threadId: 'writer' });
  const approval = await service.computer.request(
    scope,
    { kind: 'click', selector: '#go' },
    'Continue',
  );
  expect(
    (await request('/browser/writer/viewport?threadId=writer', 'POST', { width: 600, height: 800 }))
      .result,
  ).toEqual({ applied: true });
  expect(driver.resize).toHaveBeenCalledWith({ width: 600, height: 800 });
  expect(service.board.get<ComputerApproval>('computer_approval', approval.id).status).toBe(
    'rejected',
  );
  await expect(
    service.computer.execute(scope.runId, approval.id, new AbortController().signal, () => {}),
  ).rejects.toThrow('The native browser resized. Inspect it and request a new approval.');
  expect(driver.perform).not.toHaveBeenCalled();
  const next = await service.computer.request(
    scope,
    { kind: 'click', selector: '#go' },
    'Continue again',
  );
  close();
  await expect(service.computer.inspect(scope.runId)).rejects.toThrow('ended');
  expect(service.computer.browsers.list()[0]).toMatchObject({ status: 'closed', runId: null });
  expect(service.board.get<ComputerApproval>('computer_approval', next.id).status).toBe('rejected');
});
it('validates and protects registration of the private desktop host', async () => {
  const { request } = await fixture();
  const valid = {
    ownerId: identity.ownerId,
    origin: 'http://127.0.0.1:59001',
    token: 'a'.repeat(64),
  };
  expect((await request('/browser-host', 'POST', valid, { cookie: '' })).response.status).toBe(403);
  expect(
    (await request('/browser-host', 'POST', { ...valid, origin: 'https://example.com' })).response
      .status,
  ).toBe(400);
  expect((await request('/browser-host', 'POST', valid)).response.status).toBe(200);
});
