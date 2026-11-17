import { afterEach, expect, it, vi } from 'vitest';
import { adapters } from '@pitchcrew/adapters';
import type { Run, RunContext } from '@pitchcrew/core';
import { packet } from '../../board/test/fixtures/packet.ts';
import { cleanup, confirmFixtureApplication, finish, setup } from './helpers/daemon.ts';
import { reviewSummary } from './helpers/review-summary.ts';
import * as documents from '../src/quality/documents.ts';

afterEach(cleanup);

it('reports failed runtime calls from workflow and document-correction runs without showing them', async () => {
  const { daemon, request } = await setup();
  await request('/profile', 'PUT', { name: 'profile.md', content: 'Built React interfaces.' });
  const card = daemon.service.createCard({ company: 'Fictional failures', title: 'Engineer' });
  daemon.service.moveCard(card.id, 'shortlisted');
  await confirmFixtureApplication(request, card.id);
  const record = vi.spyOn(daemon.service.diagnostics!, 'record');
  vi.spyOn(documents, 'inspectPacketDocuments').mockResolvedValue({
    reports: [],
    errors: [],
    warnings: [],
    repairable: ['resume.pdf page 2: possible stranded heading'],
  });
  const launches: RunContext[] = [];
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    launches.push(context);
    // A Pitchcrew call its MCP server rejected before the daemon saw it, then a stopped call.
    context.onToolFailure?.({
      reason: 'invalid_input',
      tool: 'pitchcrew_lint_packet',
      kind: 'check',
    });
    context.onToolFailure?.({ reason: 'cancelled', kind: 'command' });
    return context.purpose === 'application-review'
      ? { role: 'reviewer', passed: true, feedback: [], summary: reviewSummary() }
      : { role: 'writer', packet };
  });
  const run = (await request<Run>(`/cards/${card.id}/run`, 'POST', { roleId: 'writer' })).result;
  await finish(request, run.id);
  await vi.waitFor(() => expect(daemon.service.controllers.size).toBe(0));
  // The Writer's run, then its document correction and the Reviewer's recheck.
  expect(launches.map((launch) => launch.purpose)).toEqual([
    'application-draft',
    'application-draft',
    'application-review',
  ]);
  const failures = () =>
    record.mock.calls
      .filter(
        ([event, properties]) =>
          event === '$exception' &&
          (properties.error_source === 'tool_call' || properties.error_source === 'runtime_tool'),
      )
      .map(([, properties]) => properties);
  expect(failures()).toEqual(
    launches.map(() => ({
      error_source: 'tool_call',
      error_category: 'invalid_input',
      error_tool: 'pitchcrew_lint_packet',
      error_boundary: 'runtime',
      $mcp_session_id: expect.any(String),
      $session_id: expect.any(String),
    })),
  );
  // Each run reports under its own capability, and none of them keeps a step.
  expect(new Set(failures().map((failure) => failure.$mcp_session_id)).size).toBe(3);
  const runs = daemon.service.board.list<Run>('run');
  expect(runs.flatMap((saved) => saved.activity ?? [])).toEqual([]);
  // A finished run reports nothing more.
  launches[0]!.onToolFailure?.({ reason: 'internal', kind: 'command' });
  expect(failures()).toHaveLength(3);
});
