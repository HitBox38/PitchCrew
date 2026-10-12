import type { Board } from '@pitchcrew/board';
import {
  browserActionSchema,
  type Approval,
  type BrowserAction,
  browserViewportSchema,
  type BrowserViewport,
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
import { automaticNavigation } from './form-policy.ts';
import { BrowserSessions } from './sessions.ts';
import { hash } from './helpers.ts';
import type { BrowserDriver } from './types.ts';

export class ComputerManager {
  private readonly sessions = new Map<string, Promise<BrowserDriver>>();
  readonly browsers: BrowserSessions;
  private readonly busy = new Set<string>();
  private readonly busyRoles = new Set<RoleId>();
  private readonly stopped = new Set<string>();
  constructor(
    private readonly board: Board,
    private readonly directory: string,
    launch: (profile?: string) => Promise<BrowserDriver> = launchBrowser,
  ) {
    this.browsers = new BrowserSessions(directory, launch);
  }
  private session(runId: string) {
    if (this.stopped.has(runId)) throw new Error('Browser session has ended.');
    const session = this.browsers.driver(runId).catch((error) => {
      this.sessions.delete(runId);
      throw error;
    });
    this.sessions.set(runId, session);
    return session;
  }

  async inspect(runId: string) {
    this.browsers.assertAgent(runId);
    const page = await (await this.session(runId)).snapshot();
    this.browsers.assertAgent(runId);
    if (this.stopped.has(runId)) throw new Error('Browser session has ended.');
    return page;
  }
  bindBrowser(input: Parameters<BrowserSessions['bind']>[0]) {
    if (
      this.busyRoles.has(input.roleId) &&
      this.browsers.forRole(input.roleId).info.runId !== input.runId
    )
      throw new Error(
        'A browser action is still finishing. Wait before starting another browser task.',
      );
    this.browsers.bind(input);
  }
  async openBrowser(roleId: RoleId, threadId: string, cardId: string | null) {
    if (this.busyRoles.has(roleId))
      throw new Error('A browser action is in progress. Try again shortly.');
    await this.browsers.openRole(roleId, threadId, cardId);
  }
  async resizeBrowser(roleId: RoleId, viewport: BrowserViewport, leaseId?: string) {
    const size = browserViewportSchema.parse(viewport);
    const session = this.browsers.forRole(roleId);
    const allowed = () => {
      if (session.info.status !== 'open') return false;
      if (session.info.manual) {
        if (!leaseId) return false;
        this.browsers.lease(roleId, leaseId);
      } else if (leaseId) return false;
      return !this.board
        .list<ComputerApproval>('computer_approval')
        .some(
          (approval) =>
            approval.roleId === roleId && ['pending', 'approved'].includes(approval.status),
        );
    };
    if (this.busyRoles.has(roleId) || !allowed()) return false;
    this.busyRoles.add(roleId);
    try {
      const driver = await this.browsers.driver(roleId);
      if (!allowed()) return false;
      assertNoUncertainSubmission(this.board, session.info.cardId);
      return (await driver.resize?.(size)) ?? false;
    } finally {
      this.busyRoles.delete(roleId);
    }
  }
  takeControl(roleId: string) {
    const session = this.browsers.forRole(roleId);
    if (this.busyRoles.has(roleId))
      throw new Error('An agent action is in progress. Try taking control again shortly.');
    const leaseId = this.browsers.take(roleId);
    if (session.info.runId)
      this.expire(session.info.runId, 'Manual control invalidated browser approval.');
    return leaseId;
  }
  async manualInput(
    roleId: string,
    leaseId: string,
    input: import('@pitchcrew/core').BrowserInput,
  ) {
    this.browsers.lease(roleId, leaseId);
    this.browsers.renew(roleId, leaseId);
    assertNoUncertainSubmission(this.board, this.browsers.forRole(roleId).info.cardId);
    const driver = await this.browsers.driver(roleId);
    this.browsers.lease(roleId, leaseId);
    assertNoUncertainSubmission(this.board, this.browsers.forRole(roleId).info.cardId);
    if (!driver.input) throw new Error('Manual browser input is unavailable.');
    driver.prepare?.(false);
    await driver.input(input);
    this.browsers.renew(roleId, leaseId);
  }
  async returnControl(roleId: string, leaseId: string) {
    this.browsers.lease(roleId, leaseId);
    const driver = await this.browsers.driver(roleId);
    this.browsers.lease(roleId, leaseId);
    driver.invalidate?.();
    this.browsers.release(roleId, leaseId);
  }
  allowSite(roleId: string, taskId: string, origin: string, allowed: boolean, approvalId?: string) {
    const session = this.browsers.forRole(roleId);
    const approval = approvalId
      ? this.board.get<ComputerApproval>('computer_approval', approvalId)
      : undefined;
    if (
      approval &&
      (approval.status !== 'pending' ||
        approval.runId !== session.info.runId ||
        approval.roleId !== roleId ||
        approval.action.kind !== 'navigate' ||
        new URL(approval.action.url).origin !== origin)
    )
      throw new Error('The navigation request changed. Review the current task.');
    this.browsers.allowSite(roleId, taskId, origin, allowed);
    this.board.record(
      'browser_site_permission',
      {
        id: randomUUID(),
        roleId,
        taskId,
        runId: session.info.runId!,
        origin,
        allowed,
        createdAt: new Date().toISOString(),
      },
      'user',
      allowed ? 'Allowed browser site for this task' : 'Revoked browser site access',
    );
    if (approval && allowed) this.decide(approval.id, true);
  }
  private expire(runId: string, error: string) {
    for (const approval of this.board
      .list<ComputerApproval>('computer_approval')
      .filter((a) => a.runId === runId && ['pending', 'approved'].includes(a.status)))
      this.board.record(
        'computer_approval',
        { ...approval, status: 'rejected', error },
        'system',
        'Expired browser action',
      );
  }
  async request(
    scope: { runId: string; roleId: RoleId; cardId: string | null },
    raw: unknown,
    reason: string,
  ) {
    if (this.stopped.has(scope.runId)) throw new Error('Browser session has ended.');
    if (this.busyRoles.has(scope.roleId)) throw new Error('A browser action is in progress.');
    const action = browserActionSchema.parse(raw);
    assertNoUncertainSubmission(this.board, scope.cardId, action, scope.runId);
    if (!this.browsers.forRun(scope.runId)) this.browsers.bind(scope);
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
    this.busyRoles.add(scope.roleId);
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
      const browser = this.browsers.forRun(scope.runId);
      const origin =
        action.kind === 'navigate' ? new URL(action.url).origin : new URL(page.url).origin;
      const automatic =
        browser?.info.mode === 'autonomous' &&
        browser.info.allowedSites.includes(origin) &&
        !isSubmission(action) &&
        (action.kind === 'navigate'
          ? automaticNavigation(action.url)
          : ['fill', 'select', 'upload'].includes(action.kind) &&
            (await (await this.sessions.get(scope.runId))?.automatic?.(action)) === true);
      this.browsers.assertAgent(scope.runId);
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
        status: automatic ? 'approved' : 'pending',
        ...(automatic ? { automatic: true } : {}),
        error: '',
        createdAt: new Date().toISOString(),
        decidedAt: automatic ? new Date().toISOString() : null,
      };
      this.board.record(
        'computer_approval',
        approval,
        automatic ? 'system' : scope.roleId,
        automatic
          ? 'Allowed browser preparation under user-granted task site permission'
          : 'Requested browser action approval',
      );
      return approval;
    } finally {
      this.busy.delete(scope.runId);
      this.busyRoles.delete(scope.roleId);
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
    if (this.busy.has(runId) || this.busyRoles.has(approval.roleId))
      throw new Error('A browser action is in progress.');
    this.busy.add(runId);
    this.busyRoles.add(approval.roleId);
    try {
      this.browsers.assertAgent(runId);
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
      this.browsers.assertAgent(runId);
      if (approval.automatic) {
        const session = this.browsers.forRun(runId);
        const origin =
          approval.action.kind === 'navigate'
            ? new URL(approval.action.url).origin
            : new URL(page.url).origin;
        if (
          session?.info.mode !== 'autonomous' ||
          !session.info.allowedSites.includes(origin) ||
          (approval.action.kind === 'navigate'
            ? !automaticNavigation(approval.action.url)
            : !['fill', 'select', 'upload'].includes(approval.action.kind) ||
              (await driver.automatic?.(approval.action)) !== true)
        )
          throw new Error('Browser preparation permission changed. Request a new approval.');
      }
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
      if (approval.automatic) await driver.perform(approval.action, file, true);
      else await driver.perform(approval.action, file);
      authorize();
      signal.throwIfAborted();
      if (this.stopped.has(runId)) throw new Error('Browser session has ended.');
      const result = await this.inspect(runId);
      authorize();
      signal.throwIfAborted();
      return { approvalId: id, status: 'consumed', page: result };
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
      this.busyRoles.delete(approval.roleId);
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
    this.expire(runId, 'Run ended; browser approval expired.');
    this.sessions.delete(runId);
    this.browsers.stop(runId);
  }
  async close() {
    await Promise.all([...this.sessions.keys()].map((id) => this.stop(id)));
    await this.browsers.close();
  }
}
