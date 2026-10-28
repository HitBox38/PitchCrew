import { fork, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { Worker, type WorkerOptions } from 'node:worker_threads';
import { decodeWorkerValue, encodeWorkerValue, type WorkerValue } from './isolated-worker-codec.ts';
import { nodeExecutable } from './isolated-worker-node.ts';

export { nodeExecutable } from './isolated-worker-node.ts';

/** Keep Node's interruptible, heap-bounded workers even when their caller runs on Bun. */
export class IsolatedWorker extends EventEmitter {
  private readonly native?: Worker;
  private readonly child?: ChildProcess;
  private readonly exited: Promise<number>;
  private stopped = false;
  private finished = false;
  private stopTimer?: ReturnType<typeof setTimeout>;

  constructor(entry: URL, options: WorkerOptions) {
    super();
    if (!process.versions.bun) {
      const worker = new Worker(entry, options);
      this.native = worker;
      this.exited = new Promise((resolve) => worker.once('exit', resolve));
      worker.on('message', (message) => this.emit('message', message));
      worker.on('error', (error) => this.emit('error', error));
      worker.once('exit', (code) => this.emit('exit', code));
      return;
    }
    const message = { type: 'start', entry: entry.href, options: encodeWorkerValue(options) };
    const child = fork(fileURLToPath(new URL('./isolated-worker-host.ts', import.meta.url)), [], {
      execPath: nodeExecutable(),
      // Materialized workspace packages can live below node_modules in desktop installers,
      // where Node deliberately disables native TypeScript stripping. Keep their loader.
      execArgv: ['--import', import.meta.resolve('tsx')],
      serialization: 'json',
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      windowsHide: true,
    });
    this.child = child;
    let workerExit: number | undefined;
    let failed = false;
    this.exited = new Promise((resolve) => {
      child.once('close', (code) => {
        this.finished = true;
        clearTimeout(this.stopTimer);
        const result = workerExit ?? code ?? 1;
        resolve(result);
        if (workerExit === undefined && !failed && !this.stopped)
          this.emit('error', new Error('The bounded Node.js worker helper stopped unexpectedly.'));
        this.emit('exit', result);
      });
    });
    child.once('error', (error) => {
      failed = true;
      this.emit('error', error);
    });
    child.once('spawn', () => {
      if (this.stopped) return;
      child.send(message, (error) => {
        if (error && !this.stopped) {
          failed = true;
          this.emit('error', error);
        }
      });
    });
    child.on(
      'message',
      (result: { type?: string; value?: WorkerValue; error?: WorkerValue; code?: number }) => {
        try {
          if (result.type === 'exit') workerExit = result.code;
          else if (result.type === 'error' && result.error && !this.stopped) {
            failed = true;
            this.emit('error', decodeWorkerValue(result.error));
          } else if (result.type === 'message' && result.value && !this.stopped)
            this.emit('message', decodeWorkerValue(result.value));
        } catch (error) {
          failed = true;
          this.emit('error', error);
        }
      },
    );
  }

  terminate = (): Promise<number> => {
    if (this.native) return this.native.terminate();
    if (this.stopped || this.finished) return this.exited;
    this.stopped = true;
    if (this.child?.connected) this.child.send({ type: 'terminate' }, () => {});
    // The helper normally terminates its Worker and exits. A stalled startup or IPC channel
    // still cannot leave parsing alive after the caller's cancellation or deadline.
    this.stopTimer = setTimeout(() => this.child?.kill('SIGKILL'), 1000);
    this.stopTimer.unref();
    return this.exited;
  };
}
