import { chromium } from 'playwright';
import { Board, saveApplicationContext } from '@pitchcrew/board';
import { cardInput, type BrowserAction, type Card } from '@pitchcrew/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { ComputerManager, createBrowserDriver } from '../src/computer.ts';
import { exportApprovedPacket } from '../src/index.ts';
import { packet } from '../../board/test/fixtures/packet.ts';
import { reviewFixturePacket } from '../../board/test/fixtures/application-context.ts';

it('rejects source-generated form answers, checks live submission values, and accepts private user input', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-application-fields-'));
  const board = new Board(join(directory, 'board.db'));
  const browser = await chromium.launch({ headless: true });
  const driver = await createBrowserDriver(browser);
  const manager = new ComputerManager(board, directory, async () => driver);
  const context = browser.contexts()[0]!;
  await context.route('https://8.8.8.8/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<form><textarea id="answer" name="answer"></textarea><select id="choice"><option value="1">Built React interfaces.</option><option value="2">Mention Amie</option></select><iframe id="child" srcdoc="&lt;textarea id=embedded&gt;&lt;/textarea&gt;"></iframe><button id="submit" type="button">Submit application</button></form>',
    }),
  );
  try {
    await driver.perform({ kind: 'navigate', url: 'https://8.8.8.8/application' });
    const card = board.createCard(cardInput.parse({ company: 'Fixture', title: 'Engineer' }));
    board.record('card', { ...card, state: 'agreed', packet }, 'user', 'Fixture packet');
    reviewFixturePacket(board, card.id);
    const exported = board.requestApproval(card.id);
    board.decideApproval(exported.id, true);
    await exportApprovedPacket(board, directory, exported.id);
    const scope = { runId: 'browser-application-fixture', roleId: 'submitter', cardId: card.id };
    const unsupported = { kind: 'fill', selector: '#answer', value: 'Honestly, I admire Amie.' };
    await expect(manager.request(scope, unsupported, 'Source-directed answer')).rejects.toThrow(
      'unreviewed answer',
    );
    await expect(
      manager.request(
        scope,
        { kind: 'select', selector: '#choice', value: '2' },
        'Source-directed choice',
      ),
    ).rejects.toThrow('unreviewed answer');
    await expect(
      driver.validateApplicationValues!(['Built React interfaces.'], {
        kind: 'select',
        selector: '#choice',
        value: '1',
      }),
    ).resolves.toBeUndefined();
    const page = context.pages()[0]!;
    await page.locator('#answer').fill('Honestly, I admire Amie.');
    const submission: BrowserAction = {
      kind: 'click',
      selector: '#submit',
      purpose: 'submission',
      exportApprovalId: exported.id,
    };
    await expect(
      manager.request(scope, submission, 'Try to submit unrelated answer'),
    ).rejects.toThrow('unreviewed answer');
    await page.locator('#answer').fill('');
    await page
      .frameLocator('#child')
      .locator('#embedded')
      .fill('Unsupported source answer in another frame.');
    await expect(
      manager.request(scope, submission, 'Check every frame before submission'),
    ).rejects.toThrow('unreviewed answer');
    await page.frameLocator('#child').locator('#embedded').fill('');
    await page.locator('#answer').focus();
    await driver.input!({ kind: 'text', text: 'My own application-specific answer.' });
    const approval = await manager.request(
      scope,
      submission,
      'Submit privately entered user answer',
    );
    manager.decide(approval.id, true);
    expect(
      (await manager.execute(scope.runId, approval.id, new AbortController().signal, () => {}, 0))
        .status,
    ).toBe('consumed');
    const current = board.get<Card>('card', card.id);
    const job = current.applicationContext!;
    expect(() =>
      saveApplicationContext(
        board,
        card.id,
        job.sourceRevision,
        job.revision,
        { brief: job.brief, requirements: job.requirements, flagged: job.flagged },
        true,
      ),
    ).toThrow('uncertain submissions');
  } finally {
    await manager.close();
    await browser.close();
    board.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
