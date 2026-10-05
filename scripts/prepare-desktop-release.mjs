import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { materializeWorkspacePackages, pruneRuntimeDependencies } from './installer-runtime.mjs';

const root = resolve('.');
const staging = resolve('dist/installer');
if (dirname(staging) !== join(root, 'dist')) throw new Error('Invalid installer staging path.');
if (Number(process.versions.node.split('.')[0]) !== 24)
  throw new Error('Build standalone installers with Node.js 24.');
await rm(staging, { recursive: true, force: true });
const runtime = join(staging, 'runtime');
await mkdir(runtime, { recursive: true });
const files = execFileSync('git', ['ls-files', '-z', '--cached'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);
for (const file of new Set([...files, 'scripts/packaged-launcher.mjs'])) {
  if (
    !file.startsWith('packages/') &&
    file !== 'scripts/packaged-launcher.mjs' &&
    !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file)
  )
    continue;
  const target = join(runtime, file);
  await mkdir(dirname(target), { recursive: true });
  await cp(join(root, file), target);
}
await cp('packages/ui/dist', join(runtime, 'packages/ui/dist'), { recursive: true });
const app = join(staging, 'app');
await mkdir(join(app, 'node_modules'), { recursive: true });
await cp('packages/desktop/dist', join(app, 'dist'), { recursive: true });
await cp('packages/desktop/assets', join(app, 'assets'), { recursive: true });
const metadata = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile(
  join(app, 'package.json'),
  JSON.stringify({
    name: 'pitchcrew',
    version: metadata.version,
    type: 'module',
    main: 'dist/main.mjs',
    description: 'Local-first job search with a crew of AI agents',
    author: 'Tomer Norman',
  }),
);
await mkdir(join(runtime, 'node'), { recursive: true });
await cp(
  process.execPath,
  join(runtime, 'node', process.platform === 'win32' ? 'node.exe' : 'node'),
);
// Use the pinned pnpm CLI directly: no shell and no dependency on platform command shims.
execFileSync(
  process.execPath,
  [
    process.env.npm_execpath,
    'install',
    '--filter',
    '@pitchcrew/orchestrator...',
    '--prod',
    '--frozen-lockfile',
    '--config.nodeLinker=hoisted',
  ],
  { cwd: runtime, stdio: 'inherit' },
);
await pruneRuntimeDependencies(runtime);
await materializeWorkspacePackages(runtime);
execFileSync(
  process.execPath,
  [join(runtime, 'node_modules/playwright/cli.js'), 'install', 'chromium', '--no-shell'],
  {
    cwd: runtime,
    stdio: 'inherit',
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: join(runtime, 'browsers') },
  },
);
