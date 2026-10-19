/* oxlint-disable no-control-regex -- Strip terminal escape and control sequences from untrusted output. */
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { cliEnvironment } from '../process/environment.ts';
import { terminateCli } from '../process/launch.ts';

export interface MaintenanceCommand {
  file: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}
export function redactMaintenanceOutput(text: string): string {
  // oxlint-disable-next-line no-control-regex -- Remove terminal escape and control sequences from installer logs.
  let result = text
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    // oxlint-disable-next-line no-control-regex -- Installer output is untrusted terminal text.
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
  for (const [key, value] of Object.entries(process.env))
    if (/TOKEN|SECRET|PASSWORD|API_KEY|AUTH/i.test(key) && value && value.length >= 4)
      result = result.replaceAll(value, '[redacted]');
  return result
    .replace(/(?:Bearer\s+)[\w.\-+/=]+/gi, 'Bearer [redacted]')
    .replace(/\b(?:sk-|gh[pousr]_|github_pat_)[\w-]+/g, '[redacted]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, '$1[redacted]@');
}

/** Fixed server-owned argv only. Never launches a shell or opens an interactive stdin. */
export async function runMaintenanceCommand(
  command: MaintenanceCommand,
  options: {
    signal?: AbortSignal;
    timeout?: number;
    input?: string;
    onOutput?: (text: string) => void;
    onSpawn?: (pid: number) => void;
    rejectPrompts?: boolean;
  } = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  options.signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(command.file, command.args, {
      cwd: tmpdir(),
      env: { ...cliEnvironment(), ...command.env, CI: '1', NO_COLOR: '1' },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.once('spawn', () => {
      if (child.pid) options.onSpawn?.(child.pid);
    });
    let stdout = '',
      stderr = '',
      bytes = 0,
      promptTail = '';
    let failure: Error | undefined;
    const stop = (reason: string) => {
      failure ??= new Error(reason);
      terminateCli(child);
    };
    const abort = () => stop('Runtime maintenance was interrupted.');
    const timer = setTimeout(
      () => stop('Runtime maintenance timed out.'),
      options.timeout ?? 15_000,
    );
    options.signal?.addEventListener('abort', abort, { once: true });
    const receive = (chunk: Buffer, error: boolean) => {
      bytes += chunk.length;
      if (bytes > 2_000_000) {
        stop('Runtime maintenance output exceeded its limit.');
        return;
      }
      const text = chunk.toString('utf8');
      promptTail = (promptTail + text).slice(-2000);
      if (
        options.rejectPrompts &&
        /(?:\[sudo\][^\n]*password[^\n]*:|(?:^|\n)password\s*:|\[(?:y\/n|yes\/no)\]|\((?:y\/n|yes\/no)\)|press (?:enter|return))/i.test(
          promptTail,
        )
      ) {
        stop(
          'The installer requires interactive input or additional permissions. Use the manual update instructions.',
        );
        return;
      }
      if (error) stderr += text;
      else stdout += text;
      options.onOutput?.(text);
    };
    child.stdout.on('data', (chunk: Buffer) => receive(chunk, false));
    child.stderr.on('data', (chunk: Buffer) => receive(chunk, true));
    child.stdin.on('error', () => {});
    child.stdin.end(options.input);
    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    };
    child.once('error', () => {
      cleanup();
      reject(new Error('Could not start runtime maintenance command.'));
    });
    child.once('close', (code) => {
      cleanup();
      if (failure) reject(failure);
      else resolve({ code, stdout, stderr });
    });
  });
}
