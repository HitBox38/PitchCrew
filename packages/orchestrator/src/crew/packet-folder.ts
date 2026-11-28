import { savedPacketFolder } from '@pitchcrew/packet';
import { spawn } from 'node:child_process';

const openCommand = () =>
  process.platform === 'win32'
    ? 'explorer.exe'
    : process.platform === 'darwin'
      ? 'open'
      : 'xdg-open';

/** Opens a directory in the system file manager. The rejection never includes the path. */
export const openDirectory = (target: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(openCommand(), [target], { detached: true, stdio: 'ignore' });
    let settled = false;
    // Keep the listener: an unhandled error event would crash the daemon.
    child.on('error', () => {
      if (settled) return;
      settled = true;
      reject(new Error('Could not open the packet folder.'));
    });
    child.once('spawn', () => {
      settled = true;
      child.unref();
      resolve();
    });
  });

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
