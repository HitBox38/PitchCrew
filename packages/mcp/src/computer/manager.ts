import type { Board } from '@pitchcrew/board';
import {
  browserActionSchema,
  type Approval,
  type BrowserAction,
  type ComputerApproval,
  type RoleId,
} from '@pitchcrew/core';
import { digestPacket, digestArtifacts } from '@pitchcrew/board';
import { digestBytes, verifiedArtifact } from '@pitchcrew/packet';
import {
  assertNoUncertainSubmission,
  beginSubmission,
  currentExport,
  isSubmission,
  pageEvidence,
  saveAssessment,
  recordDialogContinuation,
} from './submissions.ts';
import type { Card, SubmissionAttempt } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from './driver.ts';
import { hash } from './helpers.ts';
import type { BrowserDriver } from './types.ts';

export class ComputerManager {
  private readonly sessions = new Map<string, Promise<BrowserDriver>>();
  private readonly busy = new Set<string>();
  private readonly stopped = new Set<string>();
  constructor(
    private readonly board: Board,
    private readonly directory: string,
    private readonly launch: () => Promise<BrowserDriver> = launchBrowser,
  ) {}
  private session(runId: string) {
    if (this.stopped.has(runId)) throw new Error('Browser session has ended.');
    let session = this.sessions.get(runId);
    if (!session) {
      session = this.launch().catch((error) => {
        this.sessions.delete(runId);
        throw error;
      });
      this.sessions.set(runId, session);
    }
    return session;
  }
  async inspect(runId: string) {
    return (await this.session(runId)).snapshot();
  }
  async request(
    scope: { runId: string; roleId: RoleId; cardId: string | null },
    raw: unknown,
    reason: string,
  ) {
    const action = browserActionSchema.parse(raw);
    assertNoUncertainSubmission(this.board, scope.cardId, action, scope.runId);
    if (isSubmission(action))
      currentExport(
        this.board,
        scope.cardId,
        'exportApprovalId' in action ? action.exportApprovalId : undefined,
      );
    if (
      this.board
        .list<ComputerApproval>('computer_approval')
        .some((a) => a.runId === scope.runId && ['pending', 'approved'].includes(a.status))
    )
      throw new Error('Resolve the previous browser action first.');
    if (this.busy.has(scope.runId)) throw new Error('A browser action is in progress.');
    this.busy.add(scope.runId);
    try {
      const page = await this.inspect(scope.runId);
      if (action.kind === 'dialog' && action.submissionAttemptId && !page.dialog)
        throw new Error('Submission continuation requires an inspected browser dialog.');
      if (this.stopped.has(scope.runId)) throw new Error('Browser session has ended.');
      await (await this.sessions.get(scope.runId))?.validate?.(action);
      const file = await this.uploadFile(action, scope.cardId);
      const uploadContent = file && !file.mimeType ? file.buffer.toString('utf8') : undefined;
      const uploadDigest = file ? digestBytes(file.buffer) : undefined;
      const uploadMimeType = file?.mimeType;
      const uploadPreview =
        file?.mimeType && action.kind === 'upload'
          ? this.board.get<Approval>('approval', action.exportApprovalId).packet[
              action.file.startsWith('resume.') ? 'resume' : 'coverLetter'
            ]
          : undefined;
      if (this.stopped.has(scope.runId)) throw new Error('Browser session has ended.');
      const approval: ComputerApproval = {
        id: randomUUID(),
        ...scope,
        action,
        reason,
        ...(uploadContent !== undefined ? { uploadContent } : {}),
        ...(uploadDigest
          ? { uploadDigest, uploadMimeType, ...(uploadPreview ? { uploadPreview } : {}) }
          : {}),
        page,
        digest: hash({
          ...scope,
          action,
          page: page.digest,
          uploadContent,
          ...(uploadDigest ? { uploadDigest, uploadMimeType } : {}),
        }),
        status: 'pending',
        error: '',
        createdAt: new Date().toISOString(),
        decidedAt: null,
      };
      this.board.record(
        'computer_approval',
        approval,
        scope.roleId,
        'Requested browser action approval',
      );
      return approval;
    } finally {
      this.busy.delete(scope.runId);
    }
  }
  decide(id: string, approved: boolean) {
    const current = this.board.get<ComputerApproval>('computer_approval', id);
    if (current.status !== 'pending' || this.stopped.has(current.runId))
      throw new Error('This browser action is no longer pending.');
    const next: ComputerApproval = {
      ...current,
      status: approved ? 'approved' : 'rejected',
      decidedAt: new Date().toISOString(),
    };
    this.board.record(
      'computer_approval',
      next,
      'user',
      approved ? 'Approved exact browser action' : 'Rejected browser action',
    );
    return next;
  }
  async execute(
    runId: string,
    id: string,
    signal: AbortSignal,
    authorize: () => void,
    waitMs = 30000,
  ): Promise<Record<string, unknown>> {
    let approval = this.board.get<ComputerApproval>('computer_approval', id);
    if (approval.runId !== runId) throw new Error('Approval belongs to another run.');
    const deadline = Date.now() + waitMs;
    while (approval.status === 'pending' && Date.now() < deadline) {
      await delay(Math.min(250, deadline - Date.now()), undefined, { signal });
      authorize();
      approval = this.board.get<ComputerApproval>('computer_approval', id);
    }
    authorize();
    signal.throwIfAborted();
    if (approval.status === 'pending')
      return {
        approvalId: id,
        status: 'pending',
        message:
          'Awaiting user approval. Call execute again to wait; do not finish the run while waiting.',
      };
    if (approval.status !== 'approved') throw new Error(`Browser action is ${approval.status}.`);
    if (this.busy.has(runId)) throw new Error('A browser action is in progress.');
    this.busy.add(runId);
    try {
      const driver = await this.session(runId);
      const page = await driver.snapshot();
      authorize();
      signal.throwIfAborted();
      if (
        page.digest !== approval.page.digest ||
        approval.digest !==
          hash({
            runId,
            roleId: approval.roleId,
            cardId: approval.cardId,
            action: approval.action,
            page: page.digest,
            uploadContent: approval.uploadContent,
            ...(approval.uploadDigest
              ? { uploadDigest: approval.uploadDigest, uploadMimeType: approval.uploadMimeType }
              : {}),
          })
      )
        throw new Error('The page changed. Inspect it and request a new approval.');
      await driver.validate?.(approval.action);
      const file = await this.uploadFile(approval.action, approval.cardId);
      if (
        file &&
        (approval.uploadDigest
          ? digestBytes(file.buffer) !== approval.uploadDigest
          : file.buffer.toString('utf8') !== approval.uploadContent)
      )
        throw new Error('The upload changed. Request a new approval.');
      authorize();
      signal.throwIfAborted();
      assertNoUncertainSubmission(this.board, approval.cardId, approval.action, runId);
      // Consume before any side effect; a failed/uncertain click can never reuse approval.
      const current = this.board.get<ComputerApproval>('computer_approval', id);
      if (current.status !== 'approved') throw new Error('Approval is no longer available.');
      this.board.db.transaction(() => {
        beginSubmission(this.board, approval);
        recordDialogContinuation(this.board, approval);
        this.board.record(
          'computer_approval',
          { ...current, status: 'consumed' },
          'mcp',
          'Consumed browser action approval',
        );
      })();
      await driver.perform(approval.action, file);
      return { approvalId: id, status: 'consumed', page: await driver.snapshot() };
    } catch (error) {
      const current = this.board.get<ComputerApproval>('computer_approval', id);
      this.board.record(
        'computer_approval',
        {
          ...current,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Browser action failed.',
        },
        'mcp',
        'Browser action failed; approval cannot be reused',
      );
      throw error;
    } finally {
      this.busy.delete(runId);
    }
  }
  private async uploadFile(
    action: BrowserAction,
    cardId: string | null,
  ): Promise<{ name: string; buffer: Buffer; mimeType?: string } | undefined> {
    if (action.kind !== 'upload') return undefined;
    const exported = this.board.get<Approval>('approval', action.exportApprovalId);
    if (exported.cardId !== cardId || exported.status !== 'consumed' || !exported.exportDirectory)
      throw new Error('Upload requires an exported packet for this card.');
    if (exported.artifacts && exported.artifactDigest !== digestArtifacts(exported.artifacts))
      throw new Error('Reviewed artifacts changed.');
    const card = this.board.get<Card>('card', exported.cardId);
    if (!card.packet || digestPacket(card.id, card.packet) !== exported.digest)
      throw new Error('Exported packet is stale.');
    const root = await realpath(join(this.directory, 'packets', exported.cardId));
    const path = await realpath(join(exported.exportDirectory, action.file));
    const rel = relative(root, path);
    if (rel.startsWith('..') || isAbsolute(rel))
      throw new Error('Upload is outside the exported packet.');
    const file = { name: action.file, buffer: await readFile(path) };
    const latest = this.board.get<Card>('card', exported.cardId);
    if (!latest.packet || digestPacket(latest.id, latest.packet) !== exported.digest)
      throw new Error('Exported packet is stale.');
    if (action.file.endsWith('.pdf') || action.file.endsWith('.docx')) {
      const artifact = exported.artifacts?.find((item) => item.name === action.file);
      if (!artifact || !file.buffer.equals(verifiedArtifact(artifact)))
        throw new Error('The exported file changed. Export the reviewed packet again.');
      return { ...file, mimeType: artifact.mimeType };
    }
    const key = {
      'resume.md': 'resume',
      'cover_letter.md': 'coverLetter',
      'form_answers.md': 'formAnswers',
      'note.md': 'note',
    } as const;
    if (file.buffer.toString('utf8') !== exported.packet[key[action.file as keyof typeof key]])
      throw new Error('The exported file changed. Export the reviewed packet again.');
    return file;
  }
  async assess(
    scope: { runId: string; roleId: RoleId; cardId: string | null },
    input: unknown,
    authorize: () => void = () => {},
  ) {
    const page = await this.inspect(scope.runId);
    if (this.stopped.has(scope.runId)) throw new Error('Browser session has ended.');
    authorize();
    return saveAssessment(this.board, scope, page, input);
  }
  async capture(
    scope: { runId: string; cardId: string | null },
    id: string,
    evidence: string,
    authorize: () => void = () => {},
  ) {
    const attempt = this.board.get<SubmissionAttempt>('submission_attempt', id);
    if (
      attempt.cardId !== scope.cardId ||
      attempt.runId !== scope.runId ||
      attempt.status !== 'uncertain'
    )
      throw new Error('This run cannot capture this submission.');
    const page = await this.inspect(scope.runId);
    if (this.stopped.has(scope.runId)) throw new Error('Browser session has ended.');
    if (!evidence.trim() || !page.text.includes(evidence) || page.digest === attempt.before.digest)
      throw new Error('Use an exact quotation from changed browser confirmation evidence.');
    authorize();
    const next = { ...attempt, confirmation: pageEvidence(page), evidence };
    this.board.db.transaction(() => {
      this.board.record(
        'submission_attempt',
        next,
        'mcp',
        'Captured browser evidence for user verification',
      );
      const card = this.board.get<Card>('card', attempt.cardId);
      this.board.updateCard(
        card.id,
        {
          submissionAttempts: card.submissionAttempts?.map((item) =>
            item.id === id ? next : item,
          ),
        },
        'mcp',
        'Captured submission confirmation',
      );
    })();
    return next;
  }
  async stop(runId: string) {
    this.stopped.add(runId);
    for (const approval of this.board
      .list<ComputerApproval>('computer_approval')
      .filter((a) => a.runId === runId && ['pending', 'approved'].includes(a.status)))
      this.board.record(
        'computer_approval',
        { ...approval, status: 'rejected', error: 'Run ended; browser approval expired.' },
        'system',
        'Expired browser action',
      );
    const session = this.sessions.get(runId);
    this.sessions.delete(runId);
    if (session) await session.then((driver) => driver.close()).catch(() => {});
  }
  async close() {
    await Promise.all([...this.sessions.keys()].map((id) => this.stop(id)));
  }
}
