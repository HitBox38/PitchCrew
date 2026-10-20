import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { mkdirSync, lstatSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  runMaintenanceCommand,
  redactMaintenanceOutput,
  type MaintenanceCommand,
} from '@pitchcrew/adapters';

const execute = async (command: MaintenanceCommand, lockKey: string, timeout: number) => {
  let database: Database.Database | undefined;
  let pending = '';
  const emitOutput = (text: string) => {
    if (process.connected) process.send?.({ output: redactMaintenanceOutput(text) });
  };
  try {
    // A separate worker retains the OS lock until its installer has stopped, even if
    // the owning daemon crashes. IPC disconnect cancels the owned installer tree.
    const folder = join(tmpdir(), `pitchcrew-runtime-updates-${process.getuid?.() ?? 'user'}`);
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    const info = lstatSync(folder);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      (process.getuid && info.uid !== process.getuid())
    )
      throw new Error('Runtime maintenance lock folder is unavailable.');
    const path = join(folder, `${createHash('sha256').update(lockKey).digest('hex')}.sqlite`);
    try {
      if (lstatSync(path).isSymbolicLink()) throw new Error('Invalid runtime lock file.');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    database = new Database(path, { timeout: 0 });
    chmodSync(path, 0o600);
    try {
      database.exec('BEGIN IMMEDIATE');
    } catch {
      throw new Error('Another Pitchcrew workspace is updating this installation. Wait and retry.');
    }
    const result = await runMaintenanceCommand(command, {
      signal: controller.signal,
      rejectPrompts: true,
      timeout,
      onOutput: (text) => {
        pending += text;
        const end = pending.lastIndexOf('\n');
        if (end >= 0) {
          emitOutput(pending.slice(0, end + 1));
          pending = pending.slice(end + 1);
        }
        if (pending.length > 16_000) pending = '';
      },
    });
    if (pending) emitOutput(pending);
    if (process.connected) process.send?.({ code: result.code });
  } catch (error) {
    if (process.connected)
      process.send?.({
        error: error instanceof Error ? error.message : 'Runtime installer failed.',
      });
  } finally {
    database?.close();
    if (process.connected) process.disconnect();
  }
};

const controller = new AbortController();
process.on('disconnect', () => controller.abort());
process.on('SIGTERM', () => controller.abort());
process.on('SIGINT', () => controller.abort());
let started = false;
process.on(
  'message',
  (input: {
    action?: string;
    command?: MaintenanceCommand;
    lockKey?: string;
    timeout?: number;
  }) => {
    if (input.action === 'cancel') {
      controller.abort();
      return;
    }
    if (started || input.action !== 'run' || !input.command || typeof input.lockKey !== 'string')
      return;
    started = true;
    void execute(input.command, input.lockKey, input.timeout ?? 600_000);
  },
);
