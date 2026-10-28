import { importLimits } from '@pitchcrew/core';
import type { DatabaseImportConversion } from '@pitchcrew/core';
import { IsolatedWorker as Worker } from '@pitchcrew/core/isolated-worker';
import { z } from 'zod';

/** Uploaded databases stay in memory; a bounded worker keeps SQLite off the HTTP thread. */
export const readDatabaseImport = async (data: unknown): Promise<DatabaseImportConversion> => {
  const { content } = request.parse(data);
  const bytes = Buffer.from(content, 'base64');
  if (bytes.length > importLimits.bytes) throw new Error('Import files can be at most 2 MB.');
  if (
    bytes.toString('base64') !== content ||
    bytes.subarray(0, 16).toString() !== 'SQLite format 3\0'
  )
    throw new Error(
      'This file is not a SQLite database. Choose a .db, .sqlite or .sqlite3 tracker, or a JSON or CSV export.',
    );
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(bootstrap)}`), {
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 128 },
      workerData: { module: new URL('./database-worker.ts', import.meta.url).href, bytes },
    });
    let settled = false;
    const finish = (result?: DatabaseImportConversion, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate().then(() => (error ? reject(error) : resolve(result!)), reject);
    };
    const timer = setTimeout(
      () =>
        finish(
          undefined,
          new Error('Reading this database timed out. Try a smaller JSON or CSV export.'),
        ),
      5000,
    );
    worker.once('message', (message: { result?: DatabaseImportConversion; error?: string }) =>
      finish(message.result, message.error ? new Error(message.error) : undefined),
    );
    worker.once('error', () =>
      finish(
        undefined,
        new Error(
          'Could not read this database. Choose a valid application tracker or a JSON or CSV export.',
        ),
      ),
    );
    worker.once('exit', () =>
      finish(undefined, new Error('Database reading stopped before completing.')),
    );
  });
};

const request = z
  .object({
    content: z
      .string()
      .min(1)
      .max(Math.ceil(importLimits.bytes / 3) * 4),
  })
  .strict();
const bootstrap = `
import { parentPort, workerData } from 'node:worker_threads';
import { register } from ${JSON.stringify(import.meta.resolve('tsx/esm/api'))};
register();
const { convertDatabase } = await import(workerData.module);
try { parentPort.postMessage({ result: convertDatabase(workerData.bytes) }); }
catch (error) { parentPort.postMessage({ error: error.message }); }
`;
