import type { Approval, ComputerApproval } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { approvalRequests, selectedApprovalRequest } from '../helpers.ts';

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

  it('reviews the exact approval snapshot rather than replacing its contents', () => {
    const requests = approvalRequests(data, 'pending');
    expect(selectedApprovalRequest(requests, 'packet:approved')?.approval).toBe(data.approvals[1]);
    expect(selectedApprovalRequest(requests, 'browser:pending')?.approval).toBe(
      data.computerApprovals[0],
    );
  });

  it('selects another current request when a decision removes the selected request', () => {
    const requests = approvalRequests(data, 'pending');
    expect(selectedApprovalRequest(requests, 'packet:consumed')).toBe(requests[0]);
    expect(selectedApprovalRequest(requests, null)).toBe(requests[0]);
    expect(selectedApprovalRequest([], 'packet:pending')).toBeUndefined();
  });
});
