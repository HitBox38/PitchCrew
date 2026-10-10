import { Worker } from 'node:worker_threads';

const bootstrap = `
import { parentPort, workerData } from 'node:worker_threads';
import { register } from ${JSON.stringify(import.meta.resolve('tsx/esm/api'))};
register();
const { attachmentText } = await import(workerData.module);
parentPort.postMessage(await attachmentText(workerData.bytes, workerData.mimeType));
`;

/** Keep document decompression/parsing off the daemon thread and bound its lifetime and heap. */
export async function readAttachmentText(
  bytes: Uint8Array,
  mimeType: string,
  signal: AbortSignal,
): Promise<{ text: string; truncated: boolean }> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(bootstrap)}`), {
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 256 },
      workerData: {
        module: new URL('./attachment-text.ts', import.meta.resolve('@pitchcrew/packet')).href,
        bytes,
        mimeType,
      },
    });
    let settled = false;
    const finish = (result?: { text: string; truncated: boolean }, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      void worker.terminate().then(() => (error ? reject(error) : resolve(result!)), reject);
    };
    const abort = () => finish(undefined, new Error('Run cancelled.'));
    const timer = setTimeout(
      () => finish(undefined, new Error('Attachment reading timed out. Try a smaller document.')),
      10_000,
    );
    signal.addEventListener('abort', abort, { once: true });
    worker.once('message', (result: { text: string; truncated: boolean }) => finish(result));
    worker.once('error', (error) =>
      finish(
        undefined,
        new Error(
          'Could not read this attachment. Use an unencrypted PDF, DOCX or UTF-8 text file.',
          { cause: error },
        ),
      ),
    );
    worker.once('exit', () =>
      finish(undefined, new Error('Attachment reading stopped before completing.')),
    );
  });
}
