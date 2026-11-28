import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { directorySpawnOptions, settleDirectoryOpen } from '../packet-folder.ts';

class FakeOpener extends EventEmitter {
  unref() {}
}

const open = (child: FakeOpener, platform: NodeJS.Platform, waitMs?: number) => {
  const pending = settleDirectoryOpen(child, platform, waitMs);
  child.emit('spawn');
  return pending;
};

describe('opening a packet directory', () => {
  it('hides the Windows console without treating the Explorer exit code as failure', async () => {
    expect(directorySpawnOptions).toMatchObject({
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    const child = new FakeOpener();
    const pending = open(child, 'win32');
    child.emit('exit', 1);
    await expect(pending).resolves.toBeUndefined();
  });

  it('reports a file manager that exits with an error before the folder is open', async () => {
    const child = new FakeOpener();
    const pending = open(child, 'linux', 1000);
    child.emit('exit', 1);
    await expect(pending).rejects.toThrow(/^Could not open the packet folder\.$/);
  });

  it('accepts a file manager that exits successfully or stays open', async () => {
    const exited = new FakeOpener();
    const success = open(exited, 'linux', 1000);
    exited.emit('exit', 0);
    await expect(success).resolves.toBeUndefined();

    const running = new FakeOpener();
    await expect(open(running, 'darwin', 20)).resolves.toBeUndefined();
  });

  it('reports a launcher that cannot start, without the launcher error', async () => {
    const child = new FakeOpener();
    const pending = settleDirectoryOpen(child, 'linux');
    child.emit('error', new Error('spawn xdg-open ENOENT'));
    await expect(pending).rejects.toThrow(/^Could not open the packet folder\.$/);
  });
});
