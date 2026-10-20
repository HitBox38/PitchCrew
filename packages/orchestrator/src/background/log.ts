import { appendFileSync, mkdirSync, renameSync, statSync, truncateSync } from 'node:fs';
import { dirname } from 'node:path';
import { format } from 'node:util';

/**
 * Appends timestamped lines to a log file. When the next line would pass the cap, the file moves
 * to `<file>.1`, replacing the older copy, so the logs use at most twice the cap.
 */
export const createRotatingLog = (file: string, maxBytes = maxLogBytes) => {
  mkdirSync(dirname(file), { recursive: true });
  let size = sizeOf(file);
  return {
    file,
    write: (text: string) => {
      const line = `${new Date().toISOString()} ${text}\n`;
      const bytes = Buffer.byteLength(line);
      if (size > 0 && size + bytes > maxBytes) {
        renameSync(file, `${file}.1`);
        size = 0;
      }
      appendFileSync(file, line);
      size += bytes;
    },
  };
};

/** Empties a file another process appends to (launchd output) once it passes the cap. */
export const capLogFile = (file: string, maxBytes = maxLogBytes) => {
  if (sizeOf(file) > maxBytes) truncateSync(file, 0);
};

/** Sends console output and fatal errors of a service daemon to its log file. */
export const captureServiceOutput = (log: ReturnType<typeof createRotatingLog>) => {
  for (const method of ['log', 'info', 'warn', 'error'] as const)
    console[method] = (...args: unknown[]) => log.write(format(...args));
  process.on('uncaughtException', (error) => {
    log.write(`Unexpected error: ${error.stack ?? error.message}`);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    log.write(`Unhandled rejection: ${reason instanceof Error ? reason.stack : String(reason)}`);
    process.exit(1);
  });
};

export const maxLogBytes = 5 * 1024 * 1024;

const sizeOf = (file: string) => {
  try {
    return statSync(file).size;
  } catch {
    return 0;
  }
};
