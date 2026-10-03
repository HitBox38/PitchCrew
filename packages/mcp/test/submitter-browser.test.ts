import { Board } from '@pitchcrew/board';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { ComputerManager, createBrowserDriver } from '../src/computer.ts';

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
