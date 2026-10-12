import { Board } from '@pitchcrew/board';
import { browserInputSchema } from '@pitchcrew/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, type BrowserContext } from 'playwright';
import { expect, it, vi } from 'vitest';
import { ComputerManager } from '../src/computer.ts';

it('reflows the real page, keeps frame dimensions and clicks accurate, and preserves reviewed actions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-browser-viewport-'));
  const board = new Board(join(directory, 'board.db'));
  const launch = chromium.launchPersistentContext.bind(chromium);
  let context!: BrowserContext;
  const spy = vi
    .spyOn(chromium, 'launchPersistentContext')
    .mockImplementation(async (profile, options) => {
      expect(options).toMatchObject({ headless: true, chromiumSandbox: true });
      // Fictional fixture pages only: hosted Linux runners lack a usable Chromium sandbox.
      context = await launch(profile, { ...options, chromiumSandbox: false });
      return context;
    });
  const manager = new ComputerManager(board, directory);
  try {
    await expect(manager.resizeBrowser('writer', { width: 390, height: 920 })).rejects.toThrow(
      'no open browser',
    );
    await manager.openBrowser('writer', 'chat', null);
    const driver = await manager.browsers.driver('writer');
    const page = context.pages()[0];
    await page.setContent(`<style>
      #target { position: fixed; bottom: 20px; left: 20px; width: 100px; height: 50px; color: red }
      @media (max-width: 600px) { #target { color: blue } }
      </style><button id="target">Continue</button>`);
    await page
      .locator('#target')
      .evaluate((button) =>
        button.addEventListener('click', () => button.setAttribute('data-clicked', 'yes')),
      );
    const initial = await driver.snapshot();
    expect(await manager.resizeBrowser('writer', { width: 390, height: 920 })).toBe(true);
    expect(await manager.browsers.frame('writer')).toMatchObject({ width: 390, height: 920 });
    expect(await page.locator('#target').evaluate((button) => getComputedStyle(button).color)).toBe(
      'rgb(0, 0, 255)',
    );
    const resized = await driver.snapshot();
    expect(resized.viewport).toEqual({ width: 390, height: 920 });
    expect(resized.digest).not.toBe(initial.digest);
    const lease = manager.takeControl('writer');
    expect(await manager.resizeBrowser('writer', { width: 600, height: 1000 })).toBe(false);
    await expect(
      manager.resizeBrowser('writer', { width: 600, height: 1000 }, 'wrong-lease'),
    ).rejects.toThrow('expired');
    expect(await manager.resizeBrowser('writer', { width: 600, height: 1000 }, lease)).toBe(true);
    await expect(
      manager.manualInput('writer', lease, {
        kind: 'click',
        x: 70,
        y: 850,
        viewport: { width: 390, height: 920 },
      }),
    ).rejects.toThrow('resized');
    await manager.manualInput(
      'writer',
      lease,
      browserInputSchema.parse({ kind: 'click', x: 70, y: 950 }),
    );
    expect(await page.locator('#target').getAttribute('data-clicked')).toBe('yes');
    await expect(
      manager.manualInput('writer', lease, { kind: 'click', x: 601, y: 950 }),
    ).rejects.toThrow('outside');
    await manager.returnControl('writer', lease);
    const popup = await context.newPage();
    expect(await manager.browsers.frame('writer')).toMatchObject({ width: 600, height: 1000 });
    expect(popup.viewportSize()).toEqual({ width: 600, height: 1000 });
    await popup.close();
    manager.bindBrowser({
      runId: 'viewport-run',
      roleId: 'writer',
      cardId: null,
      threadId: 'chat',
    });
    const approval = await manager.request(
      { runId: 'viewport-run', roleId: 'writer', cardId: null },
      { kind: 'click', selector: '#target' },
      'Continue the fictional form',
    );
    expect(await manager.resizeBrowser('writer', { width: 390, height: 920 })).toBe(false);
    expect(page.viewportSize()).toEqual({ width: 600, height: 1000 });
    manager.decide(approval.id, false);
    expect(await manager.resizeBrowser('writer', { width: 390, height: 920 })).toBe(true);
    await driver.freshPage!();
    expect(await manager.browsers.frame('writer')).toMatchObject({ width: 390, height: 920 });
    await expect(driver.resize!({ width: 99999, height: 920 })).rejects.toThrow();
  } finally {
    await manager.close();
    spy.mockRestore();
    board.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
