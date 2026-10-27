import { defaultCapabilities, type Role, type ComputerApproval } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { setup, cleanup } from './helpers/daemon.ts';

const identity = {
  id: 'fdebb1e8-41d2-4e34-89c8-e50259ae47ab',
  ownerId: '82c426cd-12d2-480e-acd3-dab28bd2fe71',
};
const fixture = async (port: number) => {
  const setManual = vi.fn(async () => {});
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
  const host = await setup(port, false, { browserLaunch: async () => driver });
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
  const { request, driver } = await fixture(14534);
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
it('expires unused approvals on native reflow and terminates browser access after host loss', async () => {
  const { service, request, driver, close } = await fixture(14535);
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
  const { request } = await fixture(14536);
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
