import { Board } from '@pitchcrew/board';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { expect, it, vi } from 'vitest';
import { ComputerManager, createBrowserDriver } from '../src/computer.ts';
import { automaticFormAction, applicationHosts } from '../src/computer/form-policy.ts';

vi.mock('node:dns/promises', () => ({ lookup: async () => [{ address: '8.8.8.8', family: 4 }] }));
it.each(Object.entries(applicationHosts))(
  'prepares %s native controls but gates submission and blocks automatic writes',
  async (_provider, hosts) => {
    const execute = async (approvalId: string) => {
      return manager.execute(scope.runId, approvalId, new AbortController().signal, () => {}, 0);
    };

    const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-browser-form-'));
    const board = new Board(join(directory, 'board.db'));
    const browser = await chromium.launch({ headless: true });
    const driver = await createBrowserDriver(browser);
    const context = browser.contexts()[0];
    const page = context.pages()[0];
    const submitted: string[] = [];
    await context.route('**/*', async (route) => {
      if (route.request().method() === 'POST') {
        submitted.push(route.request().postData() ?? '');
        await route.fulfill({ contentType: 'text/plain', body: 'received' });
      } else
        await route.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><title>Fictional application</title><form method="post" action="/submit" onsubmit="event.preventDefault();fetch('/submit',{method:'POST',body:document.querySelector('#name').value}).then(()=>document.querySelector('#result').textContent='Received')"><label>Name<input id="name" name="name" oninput="fetch('/submit',{method:'POST',body:'unexpected'}).catch(()=>document.querySelector('#blocked').textContent='Blocked')"></label><label>Location<select id="location"><option value="remote">Remote</option><option value="onsite">Onsite</option></select></label><input id="resume" type="file"><input id="password" type="password"><button type="submit" id="submit">Submit application</button></form><output id="blocked"></output><output id="result"></output>`,
        });
    });
    const manager = new ComputerManager(board, directory, async () => driver);
    const scope = { runId: 'native-form-run', roleId: 'writer', cardId: null };
    const origin = `https://${hosts[0]}`;
    manager.browsers.bind({ ...scope, taskId: 'task', mode: 'autonomous' });
    try {
      const navigation = await manager.request(
        scope,
        { kind: 'navigate', url: `${origin}/fictional` },
        'Open fictional application',
      );
      manager.allowSite('writer', 'task', origin, true, navigation.id);
      await execute(navigation.id);
      const fill = await manager.request(
        scope,
        { kind: 'fill', selector: '#name', value: 'Fictional Person' },
        'Prepare name',
      );
      expect(fill).toMatchObject({ automatic: true, status: 'approved' });
      await execute(fill.id);
      await page.locator('#blocked').filter({ hasText: 'Blocked' }).waitFor();
      expect(submitted).toEqual([]);
      expect(
        await automaticFormAction(page, { kind: 'select', selector: '#location', value: 'onsite' }),
      ).toBe(true);
      expect(
        await automaticFormAction(page, {
          kind: 'upload',
          selector: '#resume',
          exportApprovalId: '00000000-0000-4000-8000-000000000000',
          file: 'resume.pdf',
        }),
      ).toBe(true);
      expect(
        await automaticFormAction(page, { kind: 'fill', selector: '#password', value: 'secret' }),
      ).toBe(false);
      expect(
        await automaticFormAction(page, { kind: 'press', selector: '#name', key: 'Enter' }),
      ).toBe(false);
      expect((await manager.inspect(scope.runId)).text).toContain('Preparation blocked');
      expect(await driver.automatic!({ kind: 'fill', selector: '#name', value: 'Other' })).toBe(
        false,
      );
      const submit = await manager.request(
        scope,
        { kind: 'click', selector: '#submit' },
        'Submit fictional application',
      );
      expect(submit.status).toBe('pending');
      expect(await execute(submit.id)).toMatchObject({ status: 'pending' });
      manager.decide(submit.id, true);
      await execute(submit.id);
      await page.locator('#result').filter({ hasText: 'Received' }).waitFor();
      expect(submitted).toEqual(['Fictional Person']);
      await page.locator('#password').evaluate((element) => {
        const input = element as HTMLInputElement;
        input.type = 'text';
        input.autocomplete = 'current-password';
        input.value = 'private-revealed-password';
      });
      expect((await manager.inspect(scope.runId)).text).not.toContain('private-revealed-password');
      await page
        .locator('#submit')
        .evaluate((node) => (node.textContent = 'Unrecognized operation'));
      expect(
        await automaticFormAction(page, { kind: 'fill', selector: '#name', value: 'Other' }),
      ).toBe(false);
    } finally {
      await manager.close();
      await browser.close();
      board.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
  30000,
);
