import { afterEach, expect, it, vi } from 'vitest';
import { adapters } from '@pitchcrew/adapters';
import type { Role, Run, Snapshot, WritingCorrection, RunContext } from '@pitchcrew/core';
import { packet } from '../../board/test/fixtures/packet.ts';
import {
  cleanup,
  setup,
  confirmFixtureApplication,
  finish,
  waitForSnapshot,
} from './helpers/daemon.ts';
import * as documents from '../src/quality/documents.ts';
const prepared = async (port: number) => {
  const env = await setup(port);
  await env.request('/profile', 'PUT', { name: 'profile.md', content: 'Built React interfaces.' });
  const card = env.daemon.service.createCard({
    company: 'Fictional quality review',
    title: 'Engineer',
    description: 'RAW-SOURCE-DO-NOT-PASS',
  });
  env.daemon.service.moveCard(card.id, 'shortlisted');
  await confirmFixtureApplication(env.request, card.id);
  return { ...env, card };
};

afterEach(cleanup);
const clearDocuments = { reports: [], errors: [], warnings: [], repairable: [] };

it('queues a current user correction into an isolated draft, preserving before/after and guide provenance', async () => {
  const { daemon, request, card } = await prepared(24631);
  vi.spyOn(documents, 'inspectPacketDocuments').mockResolvedValue(clearDocuments);
  const writer = daemon.service.board.get<Role>('role', 'writer');
  const before = { ...packet, resume: packet.resume + '\n\nA long generic opening.' };
  daemon.service.board.move(card.id, 'drafting', 'user');
  await daemon.service.applyResult(card.id, writer, { role: 'writer', packet: before }, [
    { name: 'profile.md', content: 'Built React interfaces.' },
  ]);
  const revision = (await request<Snapshot>('/snapshot')).result.quality!.writingGuide.revision;
  await request('/quality', 'POST', {
    action: 'preference',
    revision,
    text: 'Prefer concrete openings.',
    scope: 'resume',
  });
  let complete!: () => void;
  vi.spyOn(adapters.demo, 'chat').mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = () => resolve({ reply: 'Queued the requested correction.' });
      }),
  );
  const launches: RunContext[] = [];
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    launches.push(context);
    return { role: 'writer', packet };
  });
  const root = (
    await request<Run>('/roles/writer/chat', 'POST', {
      cardId: card.id,
      content: 'Please remove the generic opening. RAW-CHAT-DATA-SHOULD-NOT-BE-DRAFT-CONTEXT',
    })
  ).result;
  await vi.waitFor(() => expect(complete).toBeDefined());
  const message = daemon.service.board
    .list<import('@pitchcrew/core').ChatMessage>('message')
    .find((m) => m.from === 'user' && m.cardId === card.id)!;
  const token = [...daemon.service.capabilities.entries()].find(
    ([, cap]) => cap.runId === root.id,
  )![0];
  const queued = await daemon.service.agentCall(token, 'quality', {
    input: {
      action: 'writing_correct',
      messageId: message.id,
      quote: 'Please remove the generic opening.',
      preference: 'Remove generic openings',
      scope: 'resume',
      writerId: 'writer',
    },
  });
  expect(queued.taskId).toBeDefined();
  complete();
  await finish(request, root.id);
  await waitForSnapshot(request, (s) => s.tasks.length === 1 && s.tasks[0].status === 'completed');
  expect(launches).toHaveLength(1);
  expect(launches[0].purpose).toBe('application-draft');
  expect(launches[0].request).toBe('Please remove the generic opening.');
  expect(launches[0].writingGuide?.preferences[0].text).toBe('Prefer concrete openings.');
  expect(JSON.stringify(launches[0])).not.toContain('RAW-SOURCE-DO-NOT-PASS');
  expect(JSON.stringify(launches[0])).not.toContain('RAW-CHAT-DATA-SHOULD-NOT-BE-DRAFT-CONTEXT');
  const evidence = daemon.service.board.list<WritingCorrection>('writing_correction')[0];
  expect(evidence.before.resume).toBe(before.resume);
  expect(evidence.after?.resume).toBe(packet.resume);
  const snapshot = (await request<Snapshot>('/snapshot')).result;
  expect(snapshot.quality?.writingCorrections[0]).not.toHaveProperty('before');
});

it('runs at most one document correction plus Reviewer recheck, with scoped tools usable in both stages', async () => {
  const { daemon, request, card } = await prepared(24632);
  vi.spyOn(documents, 'inspectPacketDocuments').mockResolvedValue({
    ...clearDocuments,
    repairable: ['resume.pdf page 2: possible stranded heading'],
    warnings: ['Check the preview.'],
  });
  const guard = vi.spyOn(daemon.service.runtimeMaintenance, 'guard');
  const calls: string[] = [];
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    calls.push(context.purpose!);
    await expect(
      daemon.service.agentCall(context.mcp.env.PITCHCREW_RUN_TOKEN, 'card', {}),
    ).resolves.toHaveProperty('card');
    return context.purpose === 'application-review'
      ? { role: 'reviewer', passed: true, feedback: [] }
      : { role: 'writer', packet };
  });
  const run = (await request<Run>(`/cards/${card.id}/run`, 'POST', { roleId: 'writer' })).result;
  const snapshot = await finish(request, run.id);
  expect(calls).toEqual(['application-draft', 'application-draft', 'application-review']);
  expect(guard.mock.calls.map(([role]) => role.runtime)).toEqual(['demo', 'demo', 'demo']);
  expect(guard.mock.calls.map(([role]) => (role as Role).id)).toEqual([
    'writer',
    'writer',
    'reviewer',
  ]);
  const current = snapshot.cards.find((c) => c.id === card.id)!;
  expect(current.state).toBe('agreed');
  expect(current.feedback).toContain('Warning: Check the preview.');
  expect(current.packetReview).toBeDefined();
});

it('keeps quality mutations behind the local session and rejects stale guide writes', async () => {
  const { daemon, request } = await setup(24633);
  const denied = await fetch(`${daemon.url}/api/quality`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'learning', revision: 1, automatic: false }),
  });
  expect(denied.status).toBe(403);
  const state = (await request<Snapshot>('/snapshot')).result.quality!;
  expect(
    (
      await request('/quality', 'POST', {
        action: 'learning',
        revision: state.writingGuide.revision,
        automatic: false,
      })
    ).response.status,
  ).toBe(200);
  expect(
    (
      await request('/quality', 'POST', {
        action: 'learning',
        revision: state.writingGuide.revision,
        automatic: true,
      })
    ).response.status,
  ).toBe(400);
});

it('offers verified DOCX files for approval and export when PDF rendering fails', async () => {
  const { daemon, request, card } = await prepared(24634);
  const board = daemon.service.board;
  board.move(card.id, 'drafting', 'user');
  await daemon.service.applyResult(
    card.id,
    board.get<Role>('role', 'writer'),
    { role: 'writer', packet: { ...packet, resume: packet.resume + '\n\nمرحبا' } },
    [{ name: 'profile.md', content: 'Built React interfaces.' }],
  );
  await daemon.service.applyResult(
    card.id,
    board.get<Role>('role', 'reviewer'),
    { role: 'reviewer', passed: true, feedback: [] },
    [{ name: 'profile.md', content: 'Built React interfaces.' }],
  );
  const { response, result: approval } = await request<import('@pitchcrew/core').Approval>(
    `/cards/${card.id}/approval`,
    'POST',
    { formats: ['pdf', 'docx'] },
  );
  expect(response.status).toBe(201);
  expect(approval.artifacts?.map((a) => a.name)).toEqual([
    'cover_letter.pdf',
    'resume.docx',
    'cover_letter.docx',
  ]);
  expect(approval.documentVerification).toContainEqual(
    expect.objectContaining({ name: 'resume.pdf', status: 'blocked' }),
  );
  expect(approval.documentVerification).toContainEqual(
    expect.objectContaining({ name: 'resume.docx', status: 'verified' }),
  );
  await request(`/approvals/${approval.id}/decide`, 'POST', { approved: true });
  const exported = await request<{ directory: string }>(`/approvals/${approval.id}/export`, 'POST');
  expect(exported.response.status).toBe(200);
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  for (const artifact of approval.artifacts!)
    expect(
      (await readFile(join(exported.result.directory, artifact.name))).toString('base64'),
    ).toBe(artifact.bytes);
  expect(board.get<import('@pitchcrew/core').Approval>('approval', approval.id).status).toBe(
    'consumed',
  );
});

it('does not start a document repair stage after the user pauses its job queue', async () => {
  const { daemon, request, card } = await prepared(24635);
  vi.spyOn(documents, 'inspectPacketDocuments').mockResolvedValue({
    ...clearDocuments,
    repairable: ['Possible stranded heading'],
  });
  const launch = vi.spyOn(adapters.demo, 'run').mockImplementation(async () => {
    const queue = daemon.service.board
      .list<import('@pitchcrew/core').WorkQueue>('work_queue')
      .find((q) => q.cardId === card.id)!;
    daemon.service.board.record(
      'work_queue',
      { ...queue, paused: true, pauseKind: 'user', reason: 'Paused by you.' },
      'user',
      'Pause this job',
    );
    return { role: 'writer', packet };
  });
  const run = (await request<Run>(`/cards/${card.id}/run`, 'POST', { roleId: 'writer' })).result;
  const snapshot = await waitForSnapshot(request, (s) =>
    s.runs.some((r) => r.id === run.id && r.status !== 'running'),
  );
  expect(launch).toHaveBeenCalledTimes(1);
  expect(snapshot.runs.find((r) => r.id === run.id)).toMatchObject({
    status: 'failed',
    message: 'Paused by you.',
  });
  expect(snapshot.cards.find((c) => c.id === card.id)?.packetReview).toBeUndefined();
  expect(
    daemon.service.board
      .list<import('@pitchcrew/core').WorkQueue>('work_queue')
      .find((q) => q.cardId === card.id)?.paused,
  ).toBe(true);
});
