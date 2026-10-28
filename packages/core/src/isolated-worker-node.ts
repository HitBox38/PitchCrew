import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, realpathSync, statSync } from 'node:fs';
import { delimiter, dirname, isAbsolute, join } from 'node:path';

/** Locate genuine Node for bounded V8 workers and Node-owned npm installations. */
export const nodeExecutable = (): string => {
  const override = process.env.PITCHCREW_NODE_EXECUTABLE || undefined;
  if (override && !isAbsolute(override))
    throw new Error('PITCHCREW_NODE_EXECUTABLE must be an absolute path to Node.js.');
  const bundled = join(
    dirname(dirname(process.execPath)),
    'node',
    process.platform === 'win32' ? 'node.exe' : 'node',
  );
  const candidate =
    override ??
    (existsSync(bundled) ? bundled : !process.versions.bun ? process.execPath : pathNode());
  let executable: string;
  let signature: string;
  try {
    executable = realpathSync(candidate);
    const info = statSync(executable);
    signature = `${info.dev}:${info.ino}:${info.size}:${info.mtimeMs}`;
  } catch {
    throw new Error('A genuine Node.js helper is required for bounded document and database work.');
  }
  if (validated.get(executable) === signature) return executable;
  if (executable === process.execPath && !process.versions.bun) {
    validated.set(executable, signature);
    return executable;
  }
  const probe = spawnSync(executable, ['-p', identity], {
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 4096,
    windowsHide: true,
  });
  try {
    const result = JSON.parse(probe.stdout.trim()) as {
      node?: string;
      bun?: string;
      name?: string;
    };
    if (probe.status !== 0 || result.bun || !result.node || result.name !== 'node')
      throw new Error();
  } catch {
    throw new Error(
      'The bounded worker helper must be genuine Node.js, not Bun or another runtime.',
    );
  }
  validated.set(executable, signature);
  return executable;
};

const pathNode = (): string => {
  const path = Object.entries(process.env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] ?? '';
  for (const directory of path.split(delimiter).filter(isAbsolute)) {
    const candidate = join(directory, process.platform === 'win32' ? 'node.exe' : 'node');
    try {
      accessSync(candidate, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
      return candidate;
    } catch {
      // Continue through the source launch's inherited executable search path.
    }
  }
  throw new Error(
    'Install Node.js for bounded document and database work, then restart Pitchcrew.',
  );
};

const identity =
  'JSON.stringify({name:process.release.name,node:process.versions.node,bun:process.versions.bun})';
const validated = new Map<string, string>();
