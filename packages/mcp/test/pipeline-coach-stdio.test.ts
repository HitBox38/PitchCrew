import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  cardInput,
  defaultCapabilities,
  type PipelineReview,
  type Role,
  type RoleProposal,
} from '@pitchcrew/core';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { cleanup, resources, setup } from '../../orchestrator/test/helpers/daemon.ts';
import { configRevision } from '../../orchestrator/src/crew/pipeline/snapshots.ts';

afterEach(async () => {
  for (const resource of resources) resource.daemon.service.controllers.delete('stdio-coach');
  await cleanup();
});
it('exposes enabled Coach tools over actual stdio, preserves the HTTP input envelope and rechecks revocation', async () => {
  const { daemon, request } = await setup(14805);
  const role = daemon.service.board.get<Role>('role', 'scout');
  await daemon.service.configureRole(role.id, {
    ...role,
    capabilities: { ...defaultCapabilities, reviewPipeline: true, proposeCrewChanges: true },
  });
  const card = daemon.service.board.createCard(
    cardInput.parse({ company: 'Fictional Queue', title: 'Engineer' }),
  );
  daemon.service.board.record(
    'run',
    {
      id: 'stdio-coach',
      roleId: 'scout',
      cardId: null,
      runtime: 'demo',
      status: 'running',
      mode: 'chat',
      threadId: 'crew',
      message: 'Fictional stdio coach',
      startedAt: new Date().toISOString(),
      finishedAt: null,
    },
    'scout',
    'Fixture',
  );
  daemon.service.controllers.set('stdio-coach', new AbortController());
  daemon.service.capabilities.set('stdio-token', {
    runId: 'stdio-coach',
    roleId: 'scout',
    cardId: null,
  });
  const client = new Client({ name: 'coach-contract-test', version: '1.0.0' });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [
          '--import',
          import.meta.resolve('tsx'),
          fileURLToPath(new URL('../src/cli.ts', import.meta.url)),
        ],
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              (entry): entry is [string, string] => entry[1] !== undefined,
            ),
          ),
          PITCHCREW_DAEMON_URL: daemon.url,
          PITCHCREW_RUN_TOKEN: 'stdio-token',
        },
        stderr: 'pipe',
      }),
    );
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'pitchcrew_read_pipeline',
        'pitchcrew_save_pipeline_review',
        'pitchcrew_update_pipeline_review',
        'pitchcrew_propose_crew_changes',
      ]),
    );
    const read = await client.callTool({
      name: 'pitchcrew_read_pipeline',
      arguments: { input: { section: 'roles', limit: 2 } },
    });
    expect(read.isError).not.toBe(true);
    expect((read.structuredContent as { items: unknown[] }).items).toHaveLength(2);
    expect(JSON.stringify(read.structuredContent)).not.toContain(role.instructions);
    const reviewCall = await client.callTool({
      name: 'pitchcrew_save_pipeline_review',
      arguments: {
        input: {
          title: 'Stdio batch',
          scope: { cardIds: [card.id] },
          criteria: ['Evidence'],
          seats: daemon.service.board.list<Role>('role').map((r) => ({
            roleId: r.id,
            assessment: 'insufficient_evidence',
            rationale: 'No completed fixture runs.',
          })),
          findings: [
            {
              id: 'quotation',
              targetRoleId: 'writer',
              criterion: 'Evidence',
              kind: 'hypothesis',
              finding: 'A quotation checklist may reduce review rework.',
              evidenceEventIds: [daemon.service.board.history(card.id)[0].id],
              nextRunImprovement: 'Try quotation checks before drafting.',
              measurement: 'Compare unsupported claims over the next batch.',
            },
          ],
        },
      },
    });
    expect(reviewCall.isError).not.toBe(true);
    const review = (reviewCall.structuredContent as { review: PipelineReview }).review;
    const target = daemon.service.board.get<Role>('role', 'writer');
    const proposed = await client.callTool({
      name: 'pitchcrew_propose_crew_changes',
      arguments: {
        input: {
          targetRoleId: target.id,
          targetRevision: configRevision(target),
          pipelineReviewId: review.id,
          findingId: 'quotation',
          reason: 'Trial the checklist with user review.',
          changes: { instructions: 'Fictional reviewed checklist.' },
        },
      },
    });
    expect(proposed.isError).not.toBe(true);
    const proposal = (proposed.structuredContent as { proposal: RoleProposal }).proposal;
    expect(proposal.sourceRoleId).toBe('scout');
    expect(proposal.roleId).toBe('writer');
    const attempt = await client.callTool({
      name: 'pitchcrew_read_pipeline',
      arguments: { input: { section: 'roles', limit: 51 } },
    });
    expect(attempt.isError).toBe(true);
    const current = daemon.service.board.get<Role>('role', 'scout');
    daemon.service.board.record(
      'role',
      { ...current, capabilities: { ...current.capabilities!, reviewPipeline: false } },
      'user',
      'Fixture revocation',
    );
    const revoked = await client.callTool({
      name: 'pitchcrew_read_pipeline',
      arguments: { input: { section: 'cards' } },
    });
    expect(revoked.isError).toBe(true);
    const decision = await request(`/proposals/${proposal.id}/decide`, 'POST', { approved: true });
    expect(decision.response.status).toBe(400);
    expect(daemon.service.board.get<Role>('role', 'writer').instructions).toBe(target.instructions);
  } finally {
    await client.close();
  }
});
