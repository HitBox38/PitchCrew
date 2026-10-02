import type { Role, Run } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);
it('enforces computer capability and user-only decisions and expires approvals on restart', async () => {
  const { daemon, request } = await setup(14467);
  const service = daemon.service;
  const role = service.board.get<Role>('role', 'writer');
  const run: Run = {
    id: 'computer-fixture',
    cardId: null,
    roleId: 'writer',
    runtime: 'demo',
    mode: 'chat',
    status: 'running',
    message: '',
    startedAt: '',
    finishedAt: null,
  };
  service.board.record('run', run, 'user', 'Fixture computer run');
  service.capabilities.set('computer-token', { runId: run.id, roleId: role.id, cardId: null });
  await expect(service.agentCall('computer-token', 'computer_inspect', {})).rejects.toThrow(
    'disabled',
  );
  service.board.record(
    'role',
    {
      ...role,
      capabilities: {
        messageAgents: true,
        invokeAgents: true,
        manageWorkflow: true,
        computerUse: true,
      },
    },
    'user',
    'Enable computer fixture',
  );
  vi.spyOn(service.computer, 'inspect').mockResolvedValue({
    url: 'https://example.com',
    title: 'Fixture',
    text: 'Application form',
    screenshot: '',
    digest: 'page-digest',
  });
  const response = await service.agentCall('computer-token', 'computer_request', {
    input: { kind: 'click', selector: '#submit' },
    reason: 'Submit fixture',
  });
  const approval = response.approval as import('@pitchcrew/core').ComputerApproval;
  const unauthenticated = await fetch(
    `${daemon.url}/api/computer-approvals/${approval.id}/decide`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer computer-token' },
      body: JSON.stringify({ approved: true }),
    },
  );
  expect(unauthenticated.status).toBe(403);
  await expect(
    service.agentCall('computer-token', 'computer_decide', { approvalId: approval.id }),
  ).rejects.toThrow();
  expect(
    (await request(`/computer-approvals/${approval.id}/decide`, 'POST', { approved: true }))
      .response.status,
  ).toBe(200);
  service.board.record(
    'role',
    {
      ...role,
      capabilities: {
        messageAgents: true,
        invokeAgents: true,
        manageWorkflow: true,
        computerUse: false,
      },
    },
    'user',
    'Disable computer fixture',
  );
  await expect(
    service.agentCall('computer-token', 'computer_execute', { approvalId: approval.id }),
  ).rejects.toThrow('disabled');
  await service.initialize(false);
  expect(
    (await service.snapshot()).computerApprovals.find((a) => a.id === approval.id),
  ).toMatchObject({ status: 'rejected', error: expect.stringContaining('restarted') });
  service.board.rebuild();
  expect(
    (await service.snapshot()).computerApprovals.find((a) => a.id === approval.id)?.status,
  ).toBe('rejected');
});
