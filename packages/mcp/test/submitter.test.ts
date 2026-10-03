import { Board, digestArtifacts } from '@pitchcrew/board';
import {
  cardInput,
  type BrowserSnapshot,
  type Card,
  type SubmissionAttempt,
} from '@pitchcrew/core';
import { renderArtifacts } from '@pitchcrew/packet';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { packet } from '../../board/test/fixtures/packet.ts';
import { exportApprovedPacket } from '../src/index.ts';
import { ComputerManager, resolveSubmission } from '../src/computer.ts';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0)) await dispose();
});
async function fixture(formats: ('pdf' | 'docx')[] = []) {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-submitter-'));
  const board = new Board(join(directory, 'board.db'));
  const card = board.createCard(cardInput.parse({ company: 'Fixture Studio', title: 'Engineer' }));
  for (const state of ['shortlisted', 'drafting'] as const) board.move(card.id, state, 'user');
  board.updateCard(card.id, { packet }, 'writer', 'Fictional packet');
  for (const state of ['in_review', 'agreed'] as const) board.move(card.id, state, 'reviewer');
  const exported = board.requestApproval(card.id, await renderArtifacts(packet, formats));
  board.decideApproval(exported.id, true);
  const output = await exportApprovedPacket(board, directory, exported.id);
  const page: BrowserSnapshot = {
    url: 'https://example.com/apply',
    title: 'Fictional application',
    text: 'Resume Submit',
    screenshot: '',
    digest: 'before',
    controls: [
      {
        selector: '#resume',
        label: 'Resume',
        type: 'file',
        required: true,
        visible: false,
        disabled: false,
        accept: '.pdf,.docx',
        options: [],
      },
    ],
  };
  const driver = {
    snapshot: vi.fn(async () => ({ ...page })),
    perform: vi.fn(
      async (
        _action: import('@pitchcrew/core').BrowserAction,
        _file?: { name: string; buffer: Buffer; mimeType?: string },
      ) => {},
    ),
    close: vi.fn(async () => {}),
  };
  const manager = new ComputerManager(board, directory, async () => driver);
  cleanup.push(async () => {
    await manager.close();
    board.close();
    expect(resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-submitter-'))).toBe(true);
    await rm(directory, { recursive: true, force: true });
  });
  return {
    board,
    card,
    exported,
    manager,
    driver,
    page,
    output,
    scope: { runId: 'fictional-chat', roleId: 'writer' as const, cardId: card.id },
    signal: new AbortController().signal,
  };
}

it('persists only server-inspected fields and clearly separates conditional annotations and unknown sections', async () => {
  const { board, card, manager, scope, page } = await fixture();
  page.controls!.push({ ...page.controls![0], selector: '#name', label: 'Name', type: 'text' });
  await expect(manager.assess(scope, { fields: [{ selector: '#invented' }] })).rejects.toThrow(
    'server-inspected',
  );
  const assessment = await manager.assess(scope, {
    fields: [
      {
        selector: '#resume',
        condition: 'Shown after selecting applicant type',
        missingAnswer: 'Approved PDF',
      },
    ],
    blockers: ['Sign in manually'],
    uninspected: ['After sign-in'],
  });
  expect(assessment.fields[0]).toMatchObject({
    required: true,
    visible: false,
    accept: '.pdf,.docx',
    condition: 'Shown after selecting applicant type',
  });
  expect(assessment.page).not.toHaveProperty('screenshot');
  expect(assessment.fields[1]).toMatchObject({
    selector: '#name',
    assessed: false,
    required: true,
  });
  await expect(
    manager.assess(scope, { fields: [{ selector: '#resume' }, { selector: '#resume' }] }),
  ).rejects.toThrow('Duplicate');
  board.rebuild();
  expect(board.get<Card>('card', card.id).formAssessments).toEqual([assessment]);
  await expect(manager.assess({ ...scope, cardId: null }, { fields: [] })).rejects.toThrow(
    'Attach',
  );
});

it('recovers after a run ends using explicit user external evidence without reversing later tracked status', async () => {
  const { board, card, exported, manager, scope, signal } = await fixture();
  const approval = await manager.request(
    scope,
    {
      kind: 'press',
      selector: '#submit',
      key: 'Enter',
      purpose: 'submission',
      exportApprovalId: exported.id,
    },
    'Submit reviewed packet',
  );
  manager.decide(approval.id, true);
  await manager.execute(scope.runId, approval.id, signal, () => {}, 0);
  await manager.stop(scope.runId);
  const attempt = board.list<SubmissionAttempt>('submission_attempt')[0];
  board.move(card.id, 'submitted', 'user', 'Verified tracking update');
  board.move(card.id, 'screening', 'user', 'Later stage already tracked');
  const next = resolveSubmission(board, attempt.id, true, 'User externally checked receipt', {
    url: 'https://example.com/confirmation',
    evidence: 'Application received; reference FICTIONAL-99',
    verified: true,
  });
  expect(next.externalConfirmation).toMatchObject({
    provenance: 'user',
    evidence: expect.stringContaining('FICTIONAL-99'),
  });
  expect(board.get<Card>('card', card.id).state).toBe('screening');
  board.rebuild();
  expect(board.get<SubmissionAttempt>('submission_attempt', attempt.id).status).toBe('confirmed');
});

it('rejects stale packet recovery and active competing workflows without changing the receipt', async () => {
  const { board, card, exported, manager, scope, signal } = await fixture();
  const approval = await manager.request(
    scope,
    { kind: 'click', selector: '#submit', purpose: 'submission', exportApprovalId: exported.id },
    'Submit',
  );
  manager.decide(approval.id, true);
  await manager.execute(scope.runId, approval.id, signal, () => {}, 0);
  const attempt = board.list<SubmissionAttempt>('submission_attempt')[0];
  const external = {
    url: 'https://example.com/confirmation',
    evidence: 'Fictional confirmation',
    verified: true as const,
  };
  board.record(
    'run',
    {
      id: 'competing',
      cardId: card.id,
      roleId: 'writer',
      mode: 'workflow',
      runtime: 'demo',
      status: 'running',
      message: '',
      startedAt: '',
      finishedAt: null,
    },
    'user',
    'Competing fixture run',
  );
  expect(() => resolveSubmission(board, attempt.id, true, 'Verify', external)).toThrow('competing');
  board.record(
    'run',
    {
      id: 'competing',
      cardId: card.id,
      roleId: 'writer',
      mode: 'workflow',
      runtime: 'demo',
      status: 'completed',
      message: '',
      startedAt: '',
      finishedAt: '',
    },
    'user',
    'End fixture run',
  );
  board.updateCard(
    card.id,
    { packet: { ...packet, resume: 'Changed after submission' } },
    'writer',
    'Fictional stale packet',
  );
  expect(() => resolveSubmission(board, attempt.id, true, 'Verify', external)).toThrow(
    'current packet',
  );
  expect(board.get<SubmissionAttempt>('submission_attempt', attempt.id).status).toBe('uncertain');
});

it('consumes submission approval with a durable uncertain attempt before side effects and blocks every retry path', async () => {
  const { board, exported, manager, driver, scope, signal, page, card } = await fixture();
  const approval = await manager.request(
    scope,
    { kind: 'click', selector: '#submit', purpose: 'submission', exportApprovalId: exported.id },
    'Submit exact exported fictional packet',
  );
  manager.decide(approval.id, true);
  driver.perform.mockImplementationOnce(async () => {
    expect(board.list<SubmissionAttempt>('submission_attempt')).toHaveLength(1);
    throw new Error('Network outcome unknown');
  });
  await expect(manager.execute(scope.runId, approval.id, signal, () => {}, 0)).rejects.toThrow(
    'unknown',
  );
  const attempt = board.list<SubmissionAttempt>('submission_attempt')[0];
  expect(attempt.status).toBe('uncertain');
  await expect(
    manager.request(scope, { kind: 'click', selector: '#submit' }, 'Omitted purpose'),
  ).rejects.toThrow('uncertain');
  await expect(
    manager.request(scope, { kind: 'press', selector: '#form', key: 'Enter' }, 'Keyboard retry'),
  ).rejects.toThrow('uncertain');
  expect(() => resolveSubmission(board, attempt.id, true, 'Confirm')).toThrow('Capture');
  await expect(manager.capture(scope, attempt.id, 'Invented confirmation')).rejects.toThrow(
    'quotation',
  );
  page.text = 'Your application was received. Reference FICTION-123';
  page.digest = 'confirmation';
  await manager.capture(scope, attempt.id, 'Your application was received.');
  expect(board.get<Card>('card', card.id).state).toBe('awaiting_approval');
  resolveSubmission(board, attempt.id, true, 'User verified fictional receipt');
  expect(board.get<Card>('card', card.id).state).toBe('submitted');
  board.rebuild();
  expect(board.get<SubmissionAttempt>('submission_attempt', attempt.id)).toMatchObject({
    status: 'confirmed',
    packetDigest: exported.digest,
    evidence: 'Your application was received.',
  });
  await expect(
    manager.request(
      scope,
      { kind: 'click', selector: '#submit', purpose: 'submission', exportApprovalId: exported.id },
      'Duplicate confirmed',
    ),
  ).rejects.toThrow('awaiting-approval');
});

it('uploads exact binary bytes with binary hash/MIME and rejects changed bytes and stale packets', async () => {
  const { board, card, exported, manager, driver, scope, signal, output } = await fixture([
    'pdf',
    'docx',
  ]);
  const action = {
    kind: 'upload',
    selector: '#resume',
    exportApprovalId: exported.id,
    file: 'resume.pdf',
  };
  const approval = await manager.request(scope, action, 'Upload approved PDF');
  expect(approval.uploadContent).toBeUndefined();
  expect(approval.uploadDigest).toBe(
    exported.artifacts?.find((artifact) => artifact.name === 'resume.pdf')?.digest,
  );
  manager.decide(approval.id, true);
  await manager.execute(scope.runId, approval.id, signal, () => {}, 0);
  expect(driver.perform.mock.calls[0]?.[1]).toMatchObject({ mimeType: 'application/pdf' });
  const next = await manager.request(scope, action, 'PDF retry');
  manager.decide(next.id, true);
  await writeFile(join(output, 'resume.pdf'), Buffer.from([0x80, 0x81]));
  await expect(manager.execute(scope.runId, next.id, signal, () => {}, 0)).rejects.toThrow(
    'file changed',
  );
  board.updateCard(
    card.id,
    { packet: { ...packet, resume: 'New unreviewed packet' } },
    'writer',
    'Changed packet',
  );
  await expect(
    manager.request(scope, { ...action, file: 'resume.docx' }, 'Stale DOCX'),
  ).rejects.toThrow('stale');
  expect(driver.perform).toHaveBeenCalledTimes(1);
});

it('rejects artifact manifest tampering and resolves uncertain attempts only by a user decision', async () => {
  const { board, exported, manager, scope, signal, driver } = await fixture(['docx']);
  const approval = await manager.request(
    scope,
    { kind: 'click', selector: '#submit', purpose: 'submission', exportApprovalId: exported.id },
    'Submit',
  );
  manager.decide(approval.id, true);
  await manager.execute(scope.runId, approval.id, signal, () => {}, 0);
  const attempt = board.list<SubmissionAttempt>('submission_attempt')[0];
  resolveSubmission(board, attempt.id, false, 'User checked no submission occurred');
  expect(
    (await manager.request(scope, { kind: 'click', selector: '#next' }, 'Resume browsing')).status,
  ).toBe('pending');
  const original = board.get<import('@pitchcrew/core').Approval>('approval', exported.id);
  const artifacts = original.artifacts!.map((artifact) => ({ ...artifact, bytes: 'AA==' }));
  expect(digestArtifacts(artifacts)).not.toBe(original.artifactDigest);
  board.record('approval', { ...original, artifacts }, 'user', 'Fictional corruption');
  await manager.stop(scope.runId);
  const other = { ...scope, runId: 'fresh-run' };
  await expect(
    manager.request(
      other,
      { kind: 'upload', selector: '#resume', exportApprovalId: original.id, file: 'resume.docx' },
      'Changed manifest',
    ),
  ).rejects.toThrow('artifacts changed');
  expect(driver.perform).toHaveBeenCalledTimes(1);
});
