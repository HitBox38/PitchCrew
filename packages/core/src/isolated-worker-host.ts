import { Worker, type WorkerOptions } from 'node:worker_threads';
import { decodeWorkerValue, encodeWorkerValue, type WorkerValue } from './isolated-worker-codec.ts';

let worker: Worker | undefined;
let stopping = false;
let exiting = false;

const send = (message: unknown, done?: () => void) => {
  if (!process.connected) {
    done?.();
    return;
  }
  process.send?.(message, () => done?.());
};
const exit = (code: number) => {
  if (exiting) return;
  exiting = true;
  send({ type: 'exit', code }, () => {
    if (process.connected) process.disconnect();
  });
};
const terminate = async () => {
  if (stopping) return;
  stopping = true;
  if (worker) await worker.terminate();
  else exit(0);
};
process.on('disconnect', () => void terminate());
process.on('SIGTERM', () => void terminate());
process.on('SIGINT', () => void terminate());
process.on('message', (message: { type?: string; entry?: string; options?: WorkerValue }) => {
  if (message.type === 'terminate') {
    void terminate();
    return;
  }
  if (worker || stopping || message.type !== 'start') return;
  try {
    // Bun's Node compatibility identifiers must never silently disable V8 heap limits.
    if (process.versions.bun || process.release.name !== 'node' || !process.versions.v8)
      throw new Error('The bounded worker helper must be genuine Node.js.');
    if (!message.entry || !message.options) throw new Error('Invalid bounded worker request.');
    worker = new Worker(
      new URL(message.entry),
      decodeWorkerValue(message.options) as WorkerOptions,
    );
    worker.on('message', (value: unknown) => {
      try {
        send({ type: 'message', value: encodeWorkerValue(value) });
      } catch (error) {
        send({ type: 'error', error: encodeWorkerValue(error) });
        void terminate();
      }
    });
    worker.once('error', (error) => send({ type: 'error', error: encodeWorkerValue(error) }));
    worker.once('exit', exit);
  } catch (error) {
    send({ type: 'error', error: encodeWorkerValue(error) });
    exit(1);
  }
});
