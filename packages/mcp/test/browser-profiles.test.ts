import { Board } from '@pitchcrew/board';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, type BrowserContext } from 'playwright';
import { expect, it, vi } from 'vitest';
import { ComputerManager } from '../src/computer.ts';

it('retains sign-ins across hidden browser restarts, isolates agents and resets only one profile', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-browser-profiles-'));
  const board = new Board(join(directory, 'board.db'));
  const launch = chromium.launchPersistentContext.bind(chromium);
  const contexts: BrowserContext[] = [];
  const spy = vi
    .spyOn(chromium, 'launchPersistentContext')
    .mockImplementation(async (profile, options) => {
      expect(options).toMatchObject({ headless: true, chromiumSandbox: true });
      // Fictional fixture pages only: hosted Linux runners lack a usable Chromium sandbox.
      const context = await launch(profile, { ...options, chromiumSandbox: false });
      contexts.push(context);
      return context;
    });
  const manager = new ComputerManager(board, directory);
  try {
    await manager.browsers.openRole('writer', 'chat', null);
    await contexts[0].pages()[0].setContent('<title>Main page</title><p>Fictional account</p>');
    const popup = await contexts[0].newPage();
    await popup.setContent('<title>Sign-in popup</title><p>Fictional sign-in</p>');
    expect((await manager.browsers.frame('writer'))?.title).toBe('Sign-in popup');
    await popup.close();
    expect((await manager.browsers.frame('writer'))?.title).toBe('Main page');
    await contexts[0].addCookies([
      {
        name: 'fictional_session',
        value: 'writer-only',
        domain: 'example.com',
        path: '/',
        expires: Date.now() / 1000 + 86400,
      },
    ]);
    await manager.browsers.closeRole('writer');
    await manager.browsers.openRole('writer', 'chat', null);
    expect(await contexts[1].cookies()).toMatchObject([
      { name: 'fictional_session', value: 'writer-only' },
    ]);
    await manager.browsers.openRole('scout', 'chat', null);
    expect(await contexts[2].cookies()).toEqual([]);
    await manager.browsers.closeRole('writer', true);
    await manager.browsers.openRole('writer', 'chat', null);
    expect(await contexts[3].cookies()).toEqual([]);
  } finally {
    await manager.close();
    spy.mockRestore();
    board.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
it('refuses symlinked profiles for launch and reset', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-profile-link-'));
  const outside = await mkdtemp(join(tmpdir(), 'pitchcrew-profile-target-'));
  const board = new Board(join(directory, 'board.db'));
  const launch = vi.fn();
  const manager = new ComputerManager(board, directory, launch);
  await symlink(outside, join(directory, 'browser-profiles'), 'dir');
  try {
    await expect(manager.browsers.openRole('writer', 'chat', null)).rejects.toThrow(
      'symbolic links',
    );
    await expect(manager.browsers.closeRole('writer', true)).rejects.toThrow('symbolic links');
    expect(launch).not.toHaveBeenCalled();
  } finally {
    await manager.close();
    board.close();
    await rm(directory, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

it('shares one persistent login context while keeping job pages, takeover and closure independent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-parallel-tabs-'));
  const board = new Board(join(directory, 'board.db'));
  const launch = chromium.launchPersistentContext.bind(chromium);
  const contexts: BrowserContext[] = [];
  const spy = vi
    .spyOn(chromium, 'launchPersistentContext')
    .mockImplementation(async (profile, options) => {
      const context = await launch(profile, { ...options, chromiumSandbox: false });
      contexts.push(context);
      return context;
    });
  const manager = new ComputerManager(board, directory);
  try {
    await manager.browsers.openRole('writer', 'chat-a', 'job-a');
    const first = manager.browsers.key('writer', 'chat-a', 'job-a');
    await contexts[0].pages()[0].setContent('<title>Job A</title><p>Application A</p>');
    await contexts[0].addCookies([
      { name: 'fixture_login', value: 'shared', domain: 'example.com', path: '/' },
    ]);
    await manager.browsers.openRole('writer', 'chat-b', 'job-b');
    const second = manager.browsers.key('writer', 'chat-b', 'job-b');
    expect(contexts).toHaveLength(1);
    expect(contexts[0].pages()).toHaveLength(2);
    await contexts[0].pages()[1].setContent('<title>Job B</title><p>Application B</p>');
    expect((await manager.browsers.frame(first))?.title).toBe('Job A');
    expect((await manager.browsers.frame(second))?.title).toBe('Job B');
    expect(await contexts[0].cookies()).toMatchObject([{ name: 'fixture_login', value: 'shared' }]);
    const lease = manager.browsers.take(first);
    expect(() => manager.browsers.assertAgent(first)).toThrow('Manual control');
    expect(() => manager.browsers.assertAgent(second)).not.toThrow();
    manager.browsers.release(first, lease);
    await manager.browsers.closeRole(first);
    expect(contexts[0].pages()).toHaveLength(1);
    expect((await manager.browsers.frame(second))?.title).toBe('Job B');
  } finally {
    await manager.close();
    spy.mockRestore();
    board.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
