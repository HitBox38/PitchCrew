import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { Board } from '@pitchcrew/board';
import { ComputerManager, createBrowserDriver } from '../src/computer.ts';

it('drives a real Chromium form through the approval gate without making external requests', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-browser-test-'));
  const board = new Board(join(directory, 'board.db'));
  const browser = await chromium.launch({ headless: true });
  const driver = await createBrowserDriver(browser);
  const manager = new ComputerManager(board, directory, async () => driver);
  const submitted: string[] = [];
  const context = browser.contexts()[0];
  await context.route('https://8.8.8.8/**', async (route) => {
    if (route.request().url().endsWith('/submit')) {
      submitted.push(route.request().postData() ?? '');
      await route.fulfill({ contentType: 'text/plain', body: 'Application received' });
    } else
      await route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><title>Fixture application</title><form onsubmit="event.preventDefault();fetch('/submit',{method:'POST',body:document.querySelector('#name').value}).then(()=>document.querySelector('#result').textContent='Application received')"><label>Name<input id="name"></label><label>Location<select id="location"><option value="remote">Remote</option><option value="onsite">Onsite</option></select></label><input id="attachment" type="file"><button id="submit">Apply</button></form><output id="result"></output>`,
      });
  });
  const scope = { runId: 'fixture-browser', roleId: 'writer' as const, cardId: null };
  const signal = new AbortController().signal;
  const authorize = () => {};
  async function act(input: unknown) {
    const approval = await manager.request(scope, input, 'Fixture interaction');
    expect(await manager.execute(scope.runId, approval.id, signal, authorize, 0)).toMatchObject({
      status: 'pending',
    });
    manager.decide(approval.id, true);
    return manager.execute(scope.runId, approval.id, signal, authorize, 0);
  }
  try {
    const navigated = await act({ kind: 'navigate', url: 'https://8.8.8.8/application' });
    expect(navigated).toMatchObject({
      page: { title: 'Fixture application', text: expect.stringContaining('Name') },
    });
    expect((navigated.page as { screenshot: string }).screenshot.length).toBeGreaterThan(100);
    await act({ kind: 'fill', selector: '#name', value: 'Fictional Person' });
    await act({ kind: 'select', selector: '#location', value: 'onsite' });
    expect(submitted).toEqual([]);
    await act({ kind: 'click', selector: '#submit' });
    await context
      .pages()[0]
      .locator('#result')
      .filter({ hasText: 'Application received' })
      .waitFor();
    expect(submitted).toEqual(['Fictional Person']);
    expect((await manager.inspect(scope.runId)).text).toContain('Application received');
    await expect(
      driver.perform({ kind: 'navigate', url: 'http://127.0.0.1:4417' }),
    ).rejects.toThrow('private network');
  } finally {
    await manager.close();
    await browser.close();
    board.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
