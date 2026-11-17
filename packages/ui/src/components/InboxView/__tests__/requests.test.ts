import type { Approval, ComputerApproval } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { approvalRequests } from '../helpers.ts';

const packetApproval = (status: Approval['status']): Approval => ({
  id: status,
  cardId: 'job',
  action: 'export_packet',
  digest: 'reviewed-packet',
  packet: {
    resume: 'Reviewed resume',
    coverLetter: 'Reviewed letter',
    formAnswers: '',
    note: '',
    claims: [],
  },
  status,
  createdAt: '2026-10-13T12:00:00Z',
  decidedAt: null,
});
const browserApproval = (status: ComputerApproval['status']): ComputerApproval => ({
  id: status,
  runId: 'run',
  roleId: 'submitter',
  cardId: 'job',
  action: { kind: 'navigate', url: 'https://example.com' },
  reason: 'Review this page',
  page: {
    url: 'https://example.com',
    title: 'Application',
    text: 'Exact page',
    screenshot: '',
    digest: 'page',
  },
  digest: 'action',
  status,
  error: '',
  createdAt: '2026-10-13T12:00:00Z',
  decidedAt: null,
});
const data = {
  approvals: ['pending', 'approved', 'rejected', 'consumed'].map((status) =>
    packetApproval(status as Approval['status']),
  ),
  computerApprovals: ['pending', 'approved', 'rejected', 'consumed', 'failed'].map((status) =>
    browserApproval(status as ComputerApproval['status']),
  ),
};

describe('approval review requests', () => {
  it('keeps approved exports in Waiting and all completed browser decisions in history', () => {
    expect(approvalRequests(data, 'pending').map((request) => request.key)).toEqual([
      'browser:pending',
      'browser:approved',
      'packet:pending',
      'packet:approved',
    ]);
    expect(approvalRequests(data, 'history').map((request) => request.key)).toEqual([
      'browser:rejected',
      'browser:consumed',
      'browser:failed',
      'packet:rejected',
      'packet:consumed',
    ]);
  });

  it('lists only the user’s browser decisions, never the server’s automatic approvals', () => {
    // Created approved under a browser mode or a task site grant (no mode), then used or expired.
    const automatic = (
      [
        ['approved', 'edits'],
        ['consumed', 'auto'],
        ['failed', 'full'],
        ['rejected', undefined],
        ['consumed', undefined],
      ] as const
    ).map(([status, mode], index) => ({
      ...browserApproval(status),
      id: `automatic-${index}`,
      automatic: true,
      ...(mode ? { mode } : {}),
    }));
    const mixed = { ...data, computerApprovals: [...automatic, ...data.computerApprovals] };
    for (const tab of ['pending', 'history'] as const)
      expect(approvalRequests(mixed, tab)).toEqual(approvalRequests(data, tab));
    // A user-approved request that has not run yet still waits, as before.
    expect(approvalRequests(mixed, 'pending').map((request) => request.key)).toContain(
      'browser:approved',
    );
  });
});
