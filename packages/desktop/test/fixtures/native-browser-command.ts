import { rename, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

/** Publish a complete command so the polling native fixture never sees partial JSON. */
export const writeNativeCommand = async (path: string, data: string | Uint8Array) => {
  const pending = path + '.pending';
  await writeFile(pending, data);
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(pending, path);
      return;
    } catch (error) {
      // A Windows reader can briefly prevent replacing the destination file.
      const code = (error as NodeJS.ErrnoException)?.code;
      if (attempt === 19 || (code !== 'EPERM' && code !== 'EBUSY')) throw error;
      await delay(50);
    }
  }
};
