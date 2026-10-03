import { Board } from '@pitchcrew/board';
import { cardInput, type SubmissionAttempt } from '@pitchcrew/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { ComputerManager, createBrowserDriver } from '../src/computer.ts';
import { exportApprovedPacket } from '../src/index.ts';
import { packet } from '../../board/test/fixtures/packet.ts';

it('inspects iframe controls, fingerprints iframe values, rejects ambiguous frames and requires approval for dialogs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-submitter-browser-'));
  const board = new Board(join(directory, 'board.db'));
  const browser = await chromium.launch({ headless: true });
  const driver = await createBrowserDriver(browser);
  const manager = new ComputerManager(board, directory, async () => driver);
  const context = browser.contexts()[0];
  await context.route('https://8.8.8.8/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: route.request().url().endsWith('/frame')
        ? '<label>Resume<input id="resume" type="file" accept=".pdf,.docx" required></label><label>Name<input id="name"></label>'
        : '<title>Fixture</title><iframe id="application" src="/frame"></iframe><iframe src="/empty"></iframe>',
    }),
  );
  const scope = { runId: 'fixture-iframe', roleId: 'writer' as const, cardId: null };
  const signal = new AbortController().signal;
  try {
    await driver.perform({ kind: 'navigate', url: 'https://8.8.8.8/application' });
    const page = context.pages()[0];
    await page.frameLocator('#application').locator('#name').waitFor();
    const snapshot = await manager.inspect(scope.runId);
    expect(snapshot.controls?.find((field) => field.label === 'Resume')).toMatchObject({
      required: true,
      accept: '.pdf,.docx',
      frame: expect.any(String),
    });
    const approval = await manager.request(
      scope,
      { kind: 'fill', frame: '#application', selector: '#name', value: 'Fictional Person' },
      'Enter fictional name',
    );
    manager.decide(approval.id, true);
    // Simulate user activity after approval. Value properties do not change outerHTML.
    await page.frameLocator('#application').locator('#name').fill('Changed manually');
    await expect(manager.execute(scope.runId, approval.id, signal, () => {}, 0)).rejects.toThrow(
      'page changed',
    );
    await expect(
      manager.request(
        scope,
        { kind: 'fill', frame: 'iframe', selector: '#name', value: 'Fictional Person' },
        'Ambiguous',
      ),
    ).rejects.toThrow('exactly one frame');
    // Fixture-only JS creates a dialog; no agent JS surface is exposed.
    const dialogOpened = page.waitForEvent('dialog');
    const alerted = page.evaluate(() => alert('Fictional confirmation warning'));
    await dialogOpened;
    const dialogPage = await manager.inspect(scope.runId);
    expect(dialogPage.dialog).toEqual({ type: 'alert', message: 'Fictional confirmation warning' });
    const dialogApproval = await manager.request(
      scope,
      { kind: 'dialog', decision: 'dismiss' },
      'Dismiss inspected alert',
    );
    expect(
      (await manager.execute(scope.runId, dialogApproval.id, signal, () => {}, 0)).status,
    ).toBe('pending');
    manager.decide(dialogApproval.id, true);
    await manager.execute(scope.runId, dialogApproval.id, signal, () => {}, 0);
    await alerted;
    expect((await manager.inspect(scope.runId)).dialog).toBeUndefined();
  } finally {
    await manager.close();
    await browser.close();
    board.close();
    expect(resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-submitter-browser-'))).toBe(
      true,
    );
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);

it('continues an uncertain submission only through its exact approved confirmation dialog', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-submitter-confirm-'));
  const board = new Board(join(directory, 'board.db'));
  const browser = await chromium.launch({ headless: true });
  const driver = await createBrowserDriver(browser);
  const manager = new ComputerManager(board, directory, async () => driver);
  const context = browser.contexts()[0];
  await context.route('https://8.8.8.8/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<title>Fictional form</title><button id="submit" onclick="if(confirm(\'Submit this application?\'))document.querySelector(\'#result\').textContent=\'Application received FICTION-123\'">Submit</button><output id="result"></output>',
    }),
  );
  const card = board.createCard(cardInput.parse({ company: 'Fixture Studio', title: 'Engineer' }));
  for (const state of ['shortlisted', 'drafting'] as const) board.move(card.id, state, 'user');
  board.updateCard(card.id, { packet }, 'writer', 'Fixture reviewed packet');
  for (const state of ['in_review', 'agreed'] as const) board.move(card.id, state, 'reviewer');
  const exported = board.requestApproval(card.id);
  board.decideApproval(exported.id, true);
  await exportApprovedPacket(board, directory, exported.id);
  const scope = { runId: 'submission-with-dialog', roleId: 'writer' as const, cardId: card.id };
  const signal = new AbortController().signal;
  try {
    await driver.perform({ kind: 'navigate', url: 'https://8.8.8.8/form' });
    const approval = await manager.request(
      scope,
      { kind: 'click', selector: '#submit', purpose: 'submission', exportApprovalId: exported.id },
      'Submit fictional reviewed packet',
    );
    manager.decide(approval.id, true);
    await expect(manager.execute(scope.runId, approval.id, signal, () => {}, 0)).rejects.toThrow();
    const attempt = board.list<SubmissionAttempt>('submission_attempt')[0];
    expect(attempt.status).toBe('uncertain');
    expect((await manager.inspect(scope.runId)).dialog?.type).toBe('confirm');
    await expect(
      manager.request(scope, { kind: 'dialog', decision: 'accept' }, 'Unbound dialog'),
    ).rejects.toThrow('uncertain');
    await expect(
      manager.request(
        { ...scope, runId: 'other-run' },
        { kind: 'dialog', decision: 'accept', submissionAttemptId: attempt.id },
        'Cross-run continuation',
      ),
    ).rejects.toThrow('this run');
    const continuation = await manager.request(
      scope,
      { kind: 'dialog', decision: 'accept', submissionAttemptId: attempt.id },
      'Accept exact inspected confirmation for existing attempt',
    );
    manager.decide(continuation.id, true);
    await manager.execute(scope.runId, continuation.id, signal, () => {}, 0);
    expect(
      board.get<SubmissionAttempt>('submission_attempt', attempt.id).dialogApprovalIds,
    ).toEqual([continuation.id]);
    expect(
      (await manager.capture(scope, attempt.id, 'Application received FICTION-123')).confirmation
        ?.text,
    ).toContain('Application received');
    expect(board.list<SubmissionAttempt>('submission_attempt')).toHaveLength(1);
    await expect(
      manager.request(scope, { kind: 'click', selector: '#submit' }, 'Duplicate submission'),
    ).rejects.toThrow('uncertain');
  } finally {
    await manager.close();
    await browser.close();
    board.close();
    expect(resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-submitter-confirm-'))).toBe(
      true,
    );
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
