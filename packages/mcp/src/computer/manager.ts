import { DesktopBrowserHosts } from './native-host.ts';
import type { Board } from '@pitchcrew/board';
import {
  browserActionSchema,
  browserWaitSchema,
  browserTabsSchema,
  type Approval,
  type BrowserAction,
  browserViewportSchema,
  type BrowserViewport,
  type ComputerApproval,
  type RoleId,
} from '@pitchcrew/core';
import { assertReviewedContext, digestPacket, digestArtifacts } from '@pitchcrew/board';
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
import { applicationValues, normalizedValue } from './application-values.ts';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { automaticNavigation, explorationNavigation } from './form-policy.ts';
import { BrowserSessions } from './sessions.ts';
import { hash } from './helpers.ts';
import type { BrowserDriver } from './types.ts';

export class ComputerManager {
  private readonly sessions = new Map<string, Promise<BrowserDriver>>();
  readonly browsers: BrowserSessions;
  readonly desktopHosts = new DesktopBrowserHosts();
  private readonly busy = new Set<string>();
  private readonly busyRoles = new Set<RoleId>();
  private readonly stopped = new Set<string>();
  constructor(
    private readonly board: Board,
    private readonly directory: string,
    launch?: (profile?: string) => Promise<BrowserDriver>,
  ) {
    this.browsers = new BrowserSessions(
      directory,
      launch ?? this.desktopHosts.launch,
      undefined,
      (runId) => {
        void this.stop(runId);
      },
    );
  }
  private session = (runId: string) => {
    if (this.stopped.has(runId)) throw new Error('Browser session has ended.');
    const session = this.browsers.driver(runId).catch((error) => {
      this.sessions.delete(runId);
      throw error;
    });
    this.sessions.set(runId, session);
    return session;
  };

  inspect = async (
    runId: string,
    options: { includeImage?: boolean; references?: boolean; tabId?: string } = {
      includeImage: true,
      references: true,
    },
  ) => {
    this.browsers.assertAgent(runId);
    const driver = await this.session(runId);
    this.browsers.assertAgent(runId);
    const generation = this.browsers.forRole(runId).observationGeneration;
    if (options.tabId) {
      if (!driver.targetTab) throw new Error('Browser tab targeting is unavailable.');
      await driver.targetTab(options.tabId);
    }
    const page = await driver.snapshot(options);
    this.browsers.assertAgent(runId);
    if (this.browsers.forRole(runId).observationGeneration !== generation)
      throw new Error('Manual control changed. Inspect the browser again.');
    if (this.stopped.has(runId)) throw new Error('Browser session has ended.');
    return page;
  };
  wait = async (runId: string, raw: unknown, signal: AbortSignal, authorize: () => void) => {
    const condition = browserWaitSchema.parse(raw);
    const generation = this.browsers.forRole(runId).observationGeneration;
    const deadline = Date.now() + condition.timeoutMs;
    const driver = await this.session(runId);
    if (condition.tabId) {
      this.browsers.assertAgent(runId);
      if (!driver.targetTab) throw new Error('Browser tab targeting is unavailable.');
      await driver.targetTab(condition.tabId);
    }
    if (!driver.matches) throw new Error('Browser waits are unavailable.');
    do {
      authorize();
      signal.throwIfAborted();
      this.browsers.assertAgent(runId);
      const matched = await driver.matches(condition);
      authorize();
      this.browsers.assertAgent(runId);
      if (
        this.stopped.has(runId) ||
        generation !== this.browsers.forRole(runId).observationGeneration
      )
        throw new Error('Browser control changed. Inspect again.');
      if (matched) return { matched: true };
      if (Date.now() >= deadline) return { matched: false, timedOut: true };
      await delay(Math.min(200, deadline - Date.now()), undefined, { signal });
    } while (Date.now() < deadline);
    return { matched: false, timedOut: true };
  };
  tabs = async (runId: string, raw: unknown) => {
    const command = browserTabsSchema.parse(raw);
    this.browsers.assertAgent(runId);
    const session = this.browsers.forRole(runId);
    const key = this.browsers.keyForRun(runId);
    const generation = session.observationGeneration;
    if (this.busyRoles.has(key)) throw new Error('A browser action is in progress.');
    if (command.kind !== 'list') assertNoUncertainSubmission(this.board, session.info.cardId);
    this.busyRoles.add(key);
    try {
      const driver = await this.session(runId);
      this.browsers.assertAgent(runId);
      if (!driver.tabs) throw new Error('Browser tab management is unavailable.');
      if (command.kind !== 'list')
        this.expire(runId, 'Browser tabs changed. Inspect and request a new approval.');
      const tabs = await driver.tabs(command);
      this.browsers.assertAgent(runId);
      if (generation !== session.observationGeneration || this.stopped.has(runId))
        throw new Error('Browser control changed. Inspect again.');
      return { tabs };
    } finally {
      this.busyRoles.delete(key);
    }
  };
  bindBrowser = (input: Parameters<BrowserSessions['bind']>[0]) => {
    if (!input.threadId && !input.cardId) {
      const existing = this.browsers.forRun(input.roleId);
      if (existing) input = { ...input, threadId: existing.info.threadId ?? undefined };
    }
    const key = this.browsers.key(input.roleId, input.threadId, input.cardId);
    if (this.busyRoles.has(key) && this.browsers.forRole(key).info.runId !== input.runId)
      throw new Error('A browser action is still finishing.');
    this.browsers.bind(input);
  };
  openBrowser = async (roleId: RoleId, threadId: string, cardId: string | null) => {
    if (this.busyRoles.has(this.browsers.key(roleId, threadId, cardId)))
      throw new Error('A browser action is in progress. Try again shortly.');
    await this.browsers.openRole(roleId, threadId, cardId);
  };
  resizeBrowser = async (roleId: RoleId, viewport: BrowserViewport, leaseId?: string) => {
    const size = browserViewportSchema.parse(viewport);
    const session = this.browsers.forRole(roleId);
    roleId = this.browsers.key(session.info.roleId, session.info.threadId, session.info.cardId);
    const allowed = () => {
      if (session.info.status !== 'open') return false;
      if (session.info.manual) {
        if (!leaseId) return false;
        this.browsers.lease(roleId, leaseId);
      } else if (leaseId) return false;
      return (
        !!session.info.native ||
        !this.board
          .list<ComputerApproval>('computer_approval')
          .some(
            (approval) =>
              approval.roleId === session.info.roleId &&
              approval.runId === session.info.runId &&
              ['pending', 'approved'].includes(approval.status),
          )
      );
    };
    if (this.busyRoles.has(roleId) || !allowed()) return false;
    this.busyRoles.add(roleId);
    try {
      const driver = await this.browsers.driver(roleId);
      if (!allowed()) return false;
      assertNoUncertainSubmission(this.board, session.info.cardId);
      const previous = driver.getViewport?.();
      if (
        driver.native &&
        session.info.runId &&
        (!previous || previous.width !== size.width || previous.height !== size.height)
      )
        this.expire(
          session.info.runId,
          'The native browser resized. Inspect it and request a new approval.',
        );
      return (await driver.resize?.(size)) ?? false;
    } finally {
      this.busyRoles.delete(roleId);
    }
  };
  takeControl = (roleId: string) => {
    const session = this.browsers.forRole(roleId);
    roleId = this.browsers.key(session.info.roleId, session.info.threadId, session.info.cardId);
    if (this.busyRoles.has(roleId))
      throw new Error('An agent action is in progress. Try taking control again shortly.');
    const leaseId = this.browsers.take(roleId);
    if (session.info.runId)
      this.expire(session.info.runId, 'Manual control invalidated browser approval.');
    return leaseId;
  };
  manualInput = async (
    roleId: string,
    leaseId: string,
    input: import('@pitchcrew/core').BrowserInput,
  ) => {
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
  };
  syncNativeControl = async (id: string, leaseId: string) => {
    const session = this.browsers.lease(id, leaseId);
    assertNoUncertainSubmission(this.board, session.info.cardId);
    const driver = await this.browsers.driver(id);
    this.browsers.lease(id, leaseId);
    assertNoUncertainSubmission(this.board, session.info.cardId);
    driver.privateControl?.(true);
    await driver.setManual?.(true);
  };

  returnControl = async (roleId: string, leaseId: string) => {
    this.browsers.lease(roleId, leaseId);
    const driver = await this.browsers.driver(roleId);
    this.browsers.lease(roleId, leaseId);
    await driver.setManual?.(false);
    driver.privateControl?.(false);
    driver.invalidate?.();
    this.browsers.release(roleId, leaseId);
  };
  allowSite = (
    roleId: string,
    taskId: string,
    origin: string,
    allowed: boolean,
    approvalId?: string,
    exploration = false,
  ) => {
    const session = this.browsers.forRole(roleId);
    roleId = this.browsers.key(session.info.roleId, session.info.threadId, session.info.cardId);
    const approval = approvalId
      ? this.board.get<ComputerApproval>('computer_approval', approvalId)
      : undefined;
    if (
      approval &&
      (approval.status !== 'pending' ||
        approval.runId !== session.info.runId ||
        approval.roleId !== session.info.roleId ||
        approval.action.kind !== 'navigate' ||
        new URL(approval.action.url).origin !== origin)
    )
      throw new Error('The navigation request changed. Review the current task.');
    this.browsers.allowSite(roleId, taskId, origin, allowed, exploration);
    this.board.record(
      'browser_site_permission',
      {
        id: randomUUID(),
        roleId: session.info.roleId,
        taskId,
        runId: session.info.runId!,
        origin,
        allowed,
        exploration,
        createdAt: new Date().toISOString(),
      },
      'user',
      allowed ? 'Allowed browser site for this task' : 'Revoked browser site access',
    );
    if (approval && allowed) this.decide(approval.id, true);
  };
  private expire = (runId: string, error: string) => {
    for (const approval of this.board
      .list<ComputerApproval>('computer_approval')
      .filter((a) => a.runId === runId && ['pending', 'approved'].includes(a.status)))
      this.board.record(
        'computer_approval',
        { ...approval, status: 'rejected', error },
        'system',
        'Expired browser action',
      );
  };
  request = async (
    scope: { runId: string; roleId: RoleId; cardId: string | null },
    raw: unknown,
    reason: string,
  ) => {
    if (this.stopped.has(scope.runId)) throw new Error('Browser session has ended.');
    if (this.busyRoles.has(this.browsers.keyForRun(scope.runId)))
      throw new Error('A browser action is in progress.');
    let action = browserActionSchema.parse(raw);
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
    this.busyRoles.add(this.browsers.keyForRun(scope.runId));
    try {
      this.browsers.assertAgent(scope.runId);
      const driver = await this.session(scope.runId);
      action = (await driver.resolveAction?.(action)) ?? action;
      const { diagnostics: _diagnostics, ...page } = await this.inspect(scope.runId, {
        includeImage: true,
        references: false,
      });
      if (action.kind === 'dialog' && action.submissionAttemptId && !page.dialog)
        throw new Error('Submission continuation requires an inspected browser dialog.');
      if (this.stopped.has(scope.runId)) throw new Error('Browser session has ended.');
      await driver?.validate?.(action);
      await this.checkApplicationValues(scope.cardId, action, driver);
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
        !isSubmission(action) &&
        ((browser.info.allowedSites.includes(origin) &&
          (action.kind === 'navigate'
            ? automaticNavigation(action.url)
            : ['fill', 'select', 'upload'].includes(action.kind) &&
              (await driver?.automatic?.(action)) === true)) ||
          ((browser.info.explorationSites ?? []).includes(origin) &&
            (action.kind === 'navigate'
              ? explorationNavigation(action.url)
              : (await driver?.exploration?.(action)) === true)));
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
          runId: scope.runId,
          roleId: scope.roleId,
          cardId: scope.cardId,
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
      this.busyRoles.delete(this.browsers.keyForRun(scope.runId));
    }
  };
  decide = (id: string, approved: boolean) => {
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
  };
  execute = async (
    runId: string,
    id: string,
    signal: AbortSignal,
    authorize: () => void,
    waitMs = 30000,
  ): Promise<Record<string, unknown>> => {
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
    if (approval.status !== 'approved')
      throw new Error(
        `Browser action is ${approval.status}.${approval.error ? ` ${approval.error}` : ''}`,
      );
    if (this.busy.has(runId) || this.busyRoles.has(this.browsers.keyForRun(runId)))
      throw new Error('A browser action is in progress.');
    this.busy.add(runId);
    this.busyRoles.add(this.browsers.keyForRun(runId));
    try {
      this.browsers.assertAgent(runId);
      const driver = await this.session(runId);
      if (approval.action.tabId) {
        if (!driver.targetTab) throw new Error('Browser tab targeting is unavailable.');
        await driver.targetTab(approval.action.tabId);
      }
      const page = await driver.snapshot({ includeImage: false });
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
        const permitted =
          session?.info.mode === 'autonomous' &&
          ((session.info.allowedSites.includes(origin) &&
            (approval.action.kind === 'navigate'
              ? automaticNavigation(approval.action.url)
              : ['fill', 'select', 'upload'].includes(approval.action.kind) &&
                (await driver.automatic?.(approval.action)) === true)) ||
            ((session.info.explorationSites ?? []).includes(origin) &&
              (approval.action.kind === 'navigate'
                ? explorationNavigation(approval.action.url)
                : (await driver.exploration?.(approval.action)) === true)));
        if (!permitted)
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
      await this.checkApplicationValues(approval.cardId, approval.action, driver);
      authorize();
      signal.throwIfAborted();
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
      this.busyRoles.delete(this.browsers.keyForRun(runId));
    }
  };
  private checkApplicationValues = async (
    cardId: string | null,
    action: BrowserAction,
    driver: BrowserDriver | undefined,
  ) => {
    if (!cardId || (!isSubmission(action) && !['fill', 'select'].includes(action.kind))) return;
    const values = await applicationValues(this.board, this.directory, cardId);
    if (
      action.kind === 'fill' &&
      normalizedValue(action.value) &&
      !values.includes(normalizedValue(action.value))
    )
      throw new Error(
        'Application field contains an unreviewed answer. Save your personal answer in the confirmed brief first.',
      );
    if (driver?.validateApplicationValues) await driver.validateApplicationValues(values, action);
    else if (isSubmission(action) || action.kind === 'select')
      throw new Error(
        'This browser cannot verify application field evidence. Use manual takeover.',
      );
  };
  private uploadFile = async (
    action: BrowserAction,
    cardId: string | null,
  ): Promise<{ name: string; buffer: Buffer; mimeType?: string } | undefined> => {
    if (action.kind !== 'upload') return undefined;
    const exported = this.board.get<Approval>('approval', action.exportApprovalId);
    if (exported.cardId !== cardId || exported.status !== 'consumed' || !exported.exportDirectory)
      throw new Error('Upload requires an exported packet for this card.');
    if (exported.artifacts && exported.artifactDigest !== digestArtifacts(exported.artifacts))
      throw new Error('Reviewed artifacts changed.');
    const card = this.board.get<Card>('card', exported.cardId);
    if (exported.contextRevision !== assertReviewedContext(card).revision)
      throw new Error('Exported application context is stale.');
    if (!card.packet || digestPacket(card.id, card.packet) !== exported.digest)
      throw new Error('Exported packet is stale.');
    const root = await realpath(join(this.directory, 'packets', exported.cardId));
    const path = await realpath(join(exported.exportDirectory, action.file));
    const rel = relative(root, path);
    if (rel.startsWith('..') || isAbsolute(rel))
      throw new Error('Upload is outside the exported packet.');
    const file = { name: action.file, buffer: await readFile(path) };
    const latest = this.board.get<Card>('card', exported.cardId);
    if (exported.contextRevision !== assertReviewedContext(latest).revision)
      throw new Error('Exported application context changed during upload.');
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
  };
  assess = async (
    scope: { runId: string; roleId: RoleId; cardId: string | null },
    input: unknown,
    authorize: () => void = () => {},
  ) => {
    const page = await this.inspect(scope.runId);
    if (this.stopped.has(scope.runId)) throw new Error('Browser session has ended.');
    authorize();
    return saveAssessment(this.board, scope, page, input);
  };
  capture = async (
    scope: { runId: string; cardId: string | null },
    id: string,
    evidence: string,
    authorize: () => void = () => {},
  ) => {
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
  };
  stop = async (runId: string) => {
    this.stopped.add(runId);
    this.expire(runId, 'Run ended; browser approval expired.');
    this.sessions.delete(runId);
    this.browsers.stop(runId);
  };
  close = async () => {
    await Promise.all([...this.sessions.keys()].map((id) => this.stop(id)));
    await this.browsers.close();
  };
}
