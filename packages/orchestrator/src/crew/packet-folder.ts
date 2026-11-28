import { savedPacketFolder } from '@pitchcrew/packet';
import { spawn, type SpawnOptions } from 'node:child_process';

const openCommand = () =>
  process.platform === 'win32'
    ? 'explorer.exe'
    : process.platform === 'darwin'
      ? 'open'
      : 'xdg-open';

const openFailure = 'Could not open the packet folder.';

/** Hides a Windows console flash. It does not hide Explorer's folder window. */
export const directorySpawnOptions = {
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
} satisfies SpawnOptions;

type DirectoryProcess = {
  on(event: 'error', listener: () => void): unknown;
  once(event: 'spawn', listener: () => void): unknown;
  once(event: 'exit', listener: (code: number | null) => void): unknown;
  unref(): void;
};

/**
 * Resolves once the file manager has started. Explorer exits with code 1 after a successful
 * open, so Windows ignores that code. Elsewhere, a quick non-zero exit is a failure; a process
 * that stays running has handed the folder off.
 */
export const settleDirectoryOpen = (
  child: DirectoryProcess,
  platform: NodeJS.Platform,
  waitMs = 1000,
) =>
  new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (failed: boolean) => {
      if (settled) return;
      settled = true;
      if (failed) reject(new Error(openFailure));
      else resolve();
    };
    // Keep the listener: an unhandled error event would crash the daemon.
    child.on('error', () => finish(true));
    child.once('spawn', () => {
      child.unref();
      if (platform === 'win32') {
        finish(false);
        return;
      }
      const timer = setTimeout(() => finish(false), waitMs);
      child.once('exit', (code) => {
        clearTimeout(timer);
        finish(code !== 0);
      });
    });
  });

/** Opens a directory in the system file manager. The rejection never includes the path. */
export const openDirectory = (target: string) =>
  settleDirectoryOpen(spawn(openCommand(), [target], directorySpawnOptions), process.platform);

/** Replaced in tests so a request never launches the system file manager. */
export const packetFolderOpen: { current: (path: string) => Promise<void> } = {
  current: openDirectory,
};

const unavailable = 'This job has no packet files.';

export const packetFolderAvailable = async (directory: string, cardId: string) =>
  (await savedPacketFolder(directory, cardId)) !== null;

export const openPacketFolder = async (directory: string, cardId: string) => {
  const folder = await savedPacketFolder(directory, cardId);
  if (!folder) throw new Error(unavailable);
  try {
    await packetFolderOpen.current(folder);
  } catch (error) {
    if (error instanceof Error && error.message === 'Could not open the packet folder.')
      throw error;
    throw new Error('Could not open the packet folder.');
  }
};
