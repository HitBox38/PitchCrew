import { execFileSync } from 'node:child_process';
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { materializeWorkspacePackages, pruneRuntimeDependencies } from './installer-runtime.ts';

const root = resolve('.');
const staging = resolve('dist/installer');
if (dirname(staging) !== join(root, 'dist')) throw new Error('Invalid installer staging path.');
if (process.versions.bun !== '1.4.4')
  throw new Error('Build standalone installers with Bun 1.4.4.');
const node = JSON.parse(
  execFileSync(
    process.env.PITCHCREW_NODE_EXECUTABLE || 'node',
    [
      '--print',
      'JSON.stringify({ path: process.execPath, version: process.versions.node, bun: process.versions.bun })',
    ],
    { encoding: 'utf8', windowsHide: true },
  ),
) as { path: string; version: string; bun?: string };
if (node.bun || !isAbsolute(node.path) || !/^24\./.test(node.version))
  throw new Error(
    'Standalone installers require a Node.js 24 helper on PATH or PITCHCREW_NODE_EXECUTABLE.',
  );
await rm(staging, { recursive: true, force: true });
const runtime = join(staging, 'runtime');
await mkdir(runtime, { recursive: true });
const files = execFileSync('git', ['ls-files', '-z', '--cached'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);
if (
  await access('bunfig.toml').then(
    () => true,
    () => false,
  )
)
  files.push('bunfig.toml');
for (const file of new Set([...files, 'bun.lock', 'scripts/packaged-launcher.ts'])) {
  if (
    !file.startsWith('packages/') &&
    file !== 'scripts/packaged-launcher.ts' &&
    !['package.json', 'bun.lock', 'bunfig.toml'].includes(file)
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
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid installer build identity.');
await writeFile(join(runtime, 'build-info.json'), JSON.stringify({ commit }));
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
await cp(node.path, join(runtime, 'node', process.platform === 'win32' ? 'node.exe' : 'node'));
await mkdir(join(runtime, 'bun'), { recursive: true });
await cp(process.execPath, join(runtime, 'bun', process.platform === 'win32' ? 'bun.exe' : 'bun'));
// Install with the pinned runtime directly, without shell shims or global package managers.
execFileSync(
  process.execPath,
  ['--no-env-file', 'install', '--production', '--frozen-lockfile', '--linker', 'hoisted'],
  { cwd: runtime, stdio: 'inherit' },
);
await pruneRuntimeDependencies(runtime, ['desktop']);
await materializeWorkspacePackages(runtime);
execFileSync(
  node.path,
  [join(runtime, 'node_modules/playwright/cli.js'), 'install', 'chromium', '--no-shell'],
  {
    cwd: runtime,
    stdio: 'inherit',
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: join(runtime, 'browsers') },
  },
);
