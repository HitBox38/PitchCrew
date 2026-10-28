import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { build } from 'tsdown';
import { electronExecutable } from '../../../scripts/electron-path.ts';

// Real Electron view ordering needs a desktop host; keep this in test:desktop, not headless Vitest.
const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-native-presentation-'));
try {
  await build({
    entry: {
      main: resolve('packages/desktop/test/fixtures/native-browser-presentation-main.ts'),
    },
    outDir: directory,
    format: 'esm',
    dts: false,
    deps: { neverBundle: ['electron'] },
    logLevel: 'silent',
  });
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PITCHCREW_PRESENTATION_HOME: join(directory, 'desktop'),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const { stdout } = await promisify(execFile)(electronExecutable, [join(directory, 'main.mjs')], {
    env,
    timeout: 15000,
    windowsHide: true,
  });
  if (!stdout.includes('Native browser presentation passed'))
    throw new Error('Native browser presentation did not complete.');
  process.stdout.write(stdout);
} finally {
  await rm(directory, { recursive: true, force: true });
}
