import type { ChildProcess } from 'node:child_process';
import { readFile } from 'node:fs/promises';

type Shutdown = { requestedAt: number; events: Record<string, number> };
async function readShutdown(evidence: string): Promise<Shutdown | null> {
  try {
    return JSON.parse(await readFile(`${evidence}.shutdown.json`, 'utf8'));
  } catch {
    return null;
  }
}

type Options = { timeoutMs?: number; shutdownTimeoutMs?: number; terminationGraceMs?: number };
/** A failed native check must finish even when Electron ignores graceful termination. */
export async function waitForSmokeExit(
  child: ChildProcess,
  evidence: string,
  { timeoutMs = 120_000, shutdownTimeoutMs = 10_000, terminationGraceMs = 2_000 }: Options = {},
) {
  let timedOut: string | undefined;
  let settled = false;
  let termination: ReturnType<typeof setTimeout> | undefined;
  const exitedAt = await new Promise<number>((resolve, reject) => {
    const cleanup = () => {
      settled = true;
      clearTimeout(deadline);
      clearTimeout(termination);
      clearInterval(shutdownCheck);
      child.off('exit', exited);
      child.off('error', failed);
    };
    const failed = (error: Error) => {
      cleanup();
      reject(error);
    };
    const exited = (code: number | null) => {
      cleanup();
      if (timedOut) reject(new Error(timedOut));
      else if (code !== 0) reject(new Error(`Electron check exited with ${code}.`));
      else resolve(Date.now());
    };
    const timeout = (reason: string) => {
      if (settled || timedOut) return;
      timedOut = reason;
      child.kill('SIGTERM');
      termination = setTimeout(() => {
        child.kill('SIGKILL');
        cleanup();
        reject(new Error(`${reason} Forced test cleanup.`));
      }, terminationGraceMs);
    };
    const deadline = setTimeout(
      () => timeout(`Electron check timed out after ${timeoutMs} ms.`),
      timeoutMs,
    );
    const shutdownCheck = setInterval(() => {
      void readShutdown(evidence).then((shutdown) => {
        if (shutdown && Date.now() - shutdown.requestedAt >= shutdownTimeoutMs)
          timeout(`Electron shutdown timed out after ${shutdownTimeoutMs} ms.`);
      });
    }, 100);
    child.once('error', failed);
    child.once('exit', exited);
    if (child.exitCode !== null || child.signalCode !== null)
      queueMicrotask(() => exited(child.exitCode));
  }).catch(async (error: unknown) => {
    const shutdown = await readShutdown(evidence);
    const detail = shutdown ? ` Native shutdown evidence: ${JSON.stringify(shutdown)}.` : '';
    throw new Error(`${error instanceof Error ? error.message : String(error)}${detail}`);
  });
  const shutdown = await readShutdown(evidence);
  if (!shutdown || typeof shutdown.events.quit !== 'number')
    throw new Error('Electron exited without completed native shutdown evidence.');
  return {
    shutdown,
    shutdownToExitMs: exitedAt - shutdown.requestedAt,
  };
}
