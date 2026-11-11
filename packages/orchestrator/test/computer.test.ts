import type { Role, Run } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);
it('enforces computer capability and user-only decisions and expires approvals on restart', async () => {
  const { daemon, request } = await setup(14467, false, {
    browserLaunch: async () => ({
      snapshot: async () => ({
        url: 'https://example.com',
        title: 'Fixture',
        text: 'Application form',
        screenshot: '',
        digest: 'page-digest',
      }),
      perform: async () => {},
      describeTarget: async () => ({
        tag: 'button',
        name: 'Submit',
        bounds: { x: 10, y: 20, width: 80, height: 30 },
      }),
      close: async () => {},
    }),
  });
  const service = daemon.service;
  const role = service.board.get<Role>('role', 'writer');
  const run: Run = {
    id: 'computer-fixture',
    cardId: null,
    roleId: 'writer',
    runtime: 'demo',
    mode: 'chat',
    threadId: 'writer',
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
  // Chat activity names the step like the tray does, without values.
  expect(
    service
      .chatState()
      .activityRuns?.find((item) => item.id === run.id)
      ?.activity?.map((entry) => entry.label),
  ).toContain('Asked to click “Submit”');
  const unauthenticated = await fetch(
    `${daemon.url}/api/computer-approvals/${approval.id}/decide`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer computer-token' },
      body: JSON.stringify({ approved: true }),
    },
  );
  expect(unauthenticated.status).toBe(403);
  // The element is named in the stored request; its box is served only to the user, from memory.
  expect(approval.page.elements).toEqual([{ ref: 'target', tag: 'button', name: 'Submit' }]);
  const agentTarget = await fetch(`${daemon.url}/api/computer-approvals/${approval.id}/target`, {
    headers: { authorization: 'Bearer computer-token' },
  });
  expect(agentTarget.status).toBe(403);
  expect((await request(`/computer-approvals/${approval.id}/target`)).result).toEqual({
    bounds: { x: 10, y: 20, width: 80, height: 30 },
  });
  await expect(
    service.agentCall('computer-token', 'computer_decide', { approvalId: approval.id }),
  ).rejects.toThrow();
  expect(
    (await request(`/computer-approvals/${approval.id}/decide`, 'POST', { approved: true }))
      .response.status,
  ).toBe(200);
  expect((await request(`/computer-approvals/${approval.id}/target`)).result).toEqual({
    bounds: null,
  });
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
  // The row that asked for the approval is the row that carried it out: one row per action.
  expect(
    service
      .chatState()
      .activityRuns?.find((item) => item.id === run.id)
      ?.activity?.map((entry) => entry.label)
      .filter((label) => label.includes('“Submit”')),
  ).toEqual(['Click “Submit”']);
  await service.initialize(false);
  expect(
    (await service.snapshot()).computerApprovals.find((a) => a.id === approval.id),
  ).toMatchObject({ status: 'rejected', error: expect.stringContaining('restarted') });
  service.board.rebuild();
  expect(
    (await service.snapshot()).computerApprovals.find((a) => a.id === approval.id)?.status,
  ).toBe('rejected');
});
it('keeps each browser action in one latest row through intervening calls and duplicate executions', async () => {
  const { daemon } = await setup(14468, false, {
    browserLaunch: async () => ({
      snapshot: async () => ({
        url: 'https://example.com',
        title: 'Fixture',
        text: 'Application form',
        screenshot: '',
        digest: 'page-digest',
      }),
      perform: async () => {},
      describeTarget: async () => ({ tag: 'button', name: 'Submit' }),
      close: async () => {},
    }),
  });
  const service = daemon.service;
  const role = service.board.get<Role>('role', 'writer');
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
  const run: Run = {
    id: 'computer-rows',
    cardId: null,
    roleId: 'writer',
    runtime: 'demo',
    mode: 'chat',
    threadId: 'writer',
    status: 'running',
    message: '',
    startedAt: '',
    finishedAt: null,
  };
  service.board.record('run', run, 'user', 'Fixture computer run');
  service.capabilities.set('rows-token', { runId: run.id, roleId: role.id, cardId: null });
  const page = {
    url: 'https://example.com',
    title: 'Fixture',
    text: 'Application form',
    screenshot: '',
    digest: 'page-digest',
  };
  vi.spyOn(service.computer, 'inspect').mockResolvedValue(page);
  const { approval } = (await service.agentCall('rows-token', 'computer_request', {
    input: { kind: 'click', selector: '#submit' },
    reason: 'Submit fixture',
  })) as { approval: import('@pitchcrew/core').ComputerApproval };
  await service.agentCall('rows-token', 'computer_inspect', {});
  const rows = () =>
    service
      .chatState()
      .activityRuns?.find((item) => item.id === run.id)
      ?.activity?.map((entry) => [entry.label, entry.status]) ?? [];
  // The successful execution finishes after a duplicate call for the same approval started.
  let finish!: () => void;
  vi.spyOn(service.computer, 'execute')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ approvalId: approval.id, status: 'consumed', page });
        }),
    )
    .mockRejectedValueOnce(new Error('Approval was already used.'));
  const first = service.agentCall('rows-token', 'computer_execute', { approvalId: approval.id });
  // Carried out after an inspection, the action is the latest step while it runs.
  expect(rows().at(-1)).toEqual(['Click “Submit”', 'running']);
  const duplicate = service.agentCall('rows-token', 'computer_execute', {
    approvalId: approval.id,
  });
  await expect(duplicate).rejects.toThrow('already used');
  finish();
  await first;
  // The duplicate's failure is its own row; it never overwrites the action's outcome.
  expect(rows()).toEqual([
    ['Read the page', 'completed'],
    ['Clicked “Submit”', 'completed'],
    ['Click “Submit”', 'failed'],
  ]);
  // A request the user rejects is their decision, told plainly to the agent and shown as such.
  vi.mocked(service.computer.execute).mockRestore();
  // The mocked execution never decided or consumed the first approval; settle it as carried out.
  for (const status of ['approved', 'consumed'] as const)
    service.board.record(
      'computer_approval',
      {
        ...service.board.get<import('@pitchcrew/core').ComputerApproval>(
          'computer_approval',
          approval.id,
        ),
        status,
      },
      'user',
      'Fixture consumed approval',
    );
  const { approval: declined } = (await service.agentCall('rows-token', 'computer_request', {
    input: { kind: 'click', selector: '#submit' },
    reason: 'Submit fixture again',
  })) as { approval: import('@pitchcrew/core').ComputerApproval };
  service.computer.decide(declined.id, false);
  await expect(
    service.agentCall('rows-token', 'computer_execute', { approvalId: declined.id }),
  ).rejects.toThrow('The user declined this browser action.');
  expect(rows().at(-1)).toEqual(['You declined to click “Submit”', 'completed']);
  // Invalidation (here as a job-details change records it: rejected, no reason) is not the
  // user's decision: the agent hears the neutral wording and the step is not "You declined".
  const { approval: invalidated } = (await service.agentCall('rows-token', 'computer_request', {
    input: { kind: 'click', selector: '#submit' },
    reason: 'Submit fixture a third time',
  })) as { approval: import('@pitchcrew/core').ComputerApproval };
  service.board.record(
    'computer_approval',
    { ...invalidated, status: 'rejected', decidedAt: new Date().toISOString() },
    'user',
    'Invalidated browser approval after job details changed',
  );
  await expect(
    service.agentCall('rows-token', 'computer_execute', { approvalId: invalidated.id }),
  ).rejects.toThrow('Browser action is rejected.');
  expect(rows().at(-1)).toEqual(['Click “Submit”', 'failed']);
});
