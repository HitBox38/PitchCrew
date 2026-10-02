import type { Board } from '@pitchcrew/board';
import {
  browserActionSchema,
  type Approval,
  type BrowserAction,
  type ComputerApproval,
  type RoleId,
} from '@pitchcrew/core';
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
      if (this.stopped.has(scope.runId)) throw new Error('Browser session has ended.');
      const file = await this.uploadFile(action, scope.cardId);
      const uploadContent = file?.buffer.toString('utf8');
      if (this.stopped.has(scope.runId)) throw new Error('Browser session has ended.');
      const approval: ComputerApproval = {
        id: randomUUID(),
        ...scope,
        action,
        reason,
        ...(uploadContent !== undefined ? { uploadContent } : {}),
        page,
        digest: hash({ ...scope, action, page: page.digest, uploadContent }),
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
          })
      )
        throw new Error('The page changed. Inspect it and request a new approval.');
      const file = await this.uploadFile(approval.action, approval.cardId);
      if (file && file.buffer.toString('utf8') !== approval.uploadContent)
        throw new Error('The upload changed. Request a new approval.');
      authorize();
      signal.throwIfAborted();
      // Consume before any side effect; a failed/uncertain click can never reuse approval.
      const current = this.board.get<ComputerApproval>('computer_approval', id);
      if (current.status !== 'approved') throw new Error('Approval is no longer available.');
      this.board.record(
        'computer_approval',
        { ...current, status: 'consumed' },
        'mcp',
        'Consumed browser action approval',
      );
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
  private async uploadFile(action: BrowserAction, cardId: string | null) {
    if (action.kind !== 'upload') return undefined;
    const exported = this.board.get<Approval>('approval', action.exportApprovalId);
    if (exported.cardId !== cardId || exported.status !== 'consumed' || !exported.exportDirectory)
      throw new Error('Upload requires an exported packet for this card.');
    const root = await realpath(join(this.directory, 'packets', exported.cardId));
    const path = await realpath(join(exported.exportDirectory, action.file));
    const rel = relative(root, path);
    if (rel.startsWith('..') || isAbsolute(rel))
      throw new Error('Upload is outside the exported packet.');
    const file = { name: action.file, buffer: await readFile(path) };
    const key = {
      'resume.md': 'resume',
      'cover_letter.md': 'coverLetter',
      'form_answers.md': 'formAnswers',
      'note.md': 'note',
    } as const;
    if (file.buffer.toString('utf8') !== exported.packet[key[action.file]])
      throw new Error('The exported file changed. Export the reviewed packet again.');
    return file;
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
