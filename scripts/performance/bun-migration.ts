/**
 * Reproducible local runtime/install comparison. Run with a supported Node or Bun:
 * PITCHCREW_BENCHMARK_BUN=/path/to/bun PITCHCREW_BENCHMARK_NODE=/path/to/node \
 *   bun --no-env-file --no-install scripts/performance/bun-migration.ts --output=/tmp/pitchcrew-bun-migration/performance.json
 * Installs use fresh manifest-only temp trees, frozen locks and normal trusted scripts.
 */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { arch, cpus, platform, release, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Tool = 'node' | 'bun';
type InstallTool = 'pnpm' | 'bun';
type CommandResult = { elapsedMs: number; stdout: string; stderr: string };
type RuntimeSample = {
  tool: Tool;
  repetition: number;
  readyMs: number;
  snapshotMs: number;
  rssBytes: number;
  totalProcessMs: number;
  fixture: Record<string, unknown>;
};
type InstallSample = CommandResult & { tool: InstallTool; repetition: number; warmup: boolean };
type Manifest = Record<string, unknown> & {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  trustedDependencies?: string[];
};

const repository = fileURLToPath(new URL('../../', import.meta.url));
const option = (name: string, fallback: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const output = resolve(
  option('output', join(tmpdir(), 'pitchcrew-bun-migration/performance.json')),
);
const runtimeRuns = Number(option('runtime-runs', '7'));
const installRuns = Number(option('install-runs', '3'));
if (
  !Number.isInteger(runtimeRuns) ||
  runtimeRuns < 5 ||
  !Number.isInteger(installRuns) ||
  installRuns < 3
)
  throw new Error('Collect at least five runtime samples and three install samples per tool.');
const executables = {
  node: process.env.PITCHCREW_BENCHMARK_NODE ?? 'node',
  bun: process.env.PITCHCREW_BENCHMARK_BUN ?? 'bun',
  pnpm: process.env.PITCHCREW_BENCHMARK_PNPM ?? 'pnpm',
};
const environment = {
  ...process.env,
  PATH: [dirname(executables.node), dirname(executables.bun), process.env.PATH ?? ''].join(
    process.platform === 'win32' ? ';' : ':',
  ),
  PITCHCREW_NODE_EXECUTABLE: executables.node,
  PITCHCREW_POSTHOG_DISABLED: '1',
  PITCHCREW_UPDATE_CHECKS: '0',
  PITCHCREW_SEED_SKILLS: '0',
  CI: 'true',
};
const command = (
  executable: string,
  args: string[],
  cwd = repository,
  line?: (value: string, elapsedMs: number) => void,
): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const started = performance.now();
    const child = spawn(executable, args, { cwd, env: environment, windowsHide: true });
    let stdout = '';
    let stderr = '';
    let pending = '';
    const timer = setTimeout(() => child.kill(), 300_000);
    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      pending += text;
      for (let index; (index = pending.indexOf('\n')) >= 0;) {
        line?.(pending.slice(0, index), performance.now() - started);
        pending = pending.slice(index + 1);
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0)
        reject(
          new Error(
            `${executable} ${args.join(' ')} exited ${code ?? signal}:\n${stdout}\n${stderr}`,
          ),
        );
      else resolve({ elapsedMs: performance.now() - started, stdout, stderr });
    });
  });
const git = async (...args: string[]) => (await command('git', args)).stdout;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const cleanup = async (directory: string, prefix: string) => {
  if (dirname(directory) !== resolve(tmpdir()) || !basename(directory).startsWith(prefix))
    throw new Error('Refusing unsafe benchmark workspace cleanup.');
  await rm(directory, { recursive: true, force: true });
};
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const comparison = (before: number, after: number) => ({
  before,
  after,
  saved: before - after,
  reductionPercent: ((before - after) / before) * 100,
  speedup: before / after,
});
const baseline = (await git('rev-parse', option('baseline', 'HEAD'))).trim();
const manifestPaths = [
  'package.json',
  ...(await git('ls-tree', '-r', '--name-only', baseline, 'packages'))
    .split('\n')
    .filter((name) => /^packages\/[^/]+\/package\.json$/.test(name)),
];
const originalFiles = new Map<string, string>();
const currentFiles = new Map<string, string>();
for (const path of manifestPaths) {
  originalFiles.set(path, await git('show', `${baseline}:${path}`));
  currentFiles.set(path, await readFile(join(repository, path), 'utf8'));
}
originalFiles.set('pnpm-workspace.yaml', await git('show', `${baseline}:pnpm-workspace.yaml`));
originalFiles.set('pnpm-lock.yaml', await git('show', `${baseline}:pnpm-lock.yaml`));
currentFiles.set('bun.lock', await readFile(join(repository, 'bun.lock'), 'utf8'));
const dependencyChanges: string[] = [];
const additionalDirectEdges: string[] = [];
const originalRoot = JSON.parse(originalFiles.get('package.json')!) as Manifest;
for (const path of manifestPaths) {
  const original = JSON.parse(originalFiles.get(path)!) as Manifest;
  const current = JSON.parse(currentFiles.get(path)!) as Manifest;
  for (const kind of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ] as const) {
    const currentDependencies = { ...current[kind] };
    // The Node helper imports tsx from core directly; the version already exists in the baseline.
    if (
      path === 'packages/core/package.json' &&
      kind === 'dependencies' &&
      !original.dependencies?.tsx &&
      currentDependencies.tsx === originalRoot.devDependencies?.tsx
    ) {
      additionalDirectEdges.push(`@pitchcrew/core -> tsx@${currentDependencies.tsx}`);
      delete currentDependencies.tsx;
    }
    if (
      JSON.stringify(Object.entries(original[kind] ?? {}).sort()) !==
      JSON.stringify(Object.entries(currentDependencies).sort())
    )
      dependencyChanges.push(`${path}:${kind}`);
  }
}
if (dependencyChanges.length)
  throw new Error(`Dependency declarations differ: ${dependencyChanges.join(', ')}`);
// Bun's text lock is JSON with trailing commas. Remove only commas outside strings.
const parseBunLock = (source: string) => {
  let quoted = false;
  let escaped = false;
  let json = '';
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quoted) {
      json += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else {
      if (character === '"') quoted = true;
      if (character === ',' && /^[\s]*[}\]]/.test(source.slice(index + 1))) continue;
      json += character;
    }
  }
  return JSON.parse(json) as { packages: Record<string, unknown[]> };
};
const originalPackages = new Set(
  originalFiles
    .get('pnpm-lock.yaml')!
    .split('\npackages:\n')[1]
    .split('\nsnapshots:\n')[0]
    .split('\n')
    .filter((line) => /^  \S.*:$/.test(line))
    .map((line) => line.slice(2, -1).replace(/^'|'$/g, '')),
);
const bunPackages = new Set(
  Object.values(parseBunLock(currentFiles.get('bun.lock')!).packages).map((value) =>
    String(value[0]),
  ),
);
const lockAudit = {
  pnpmPackages: originalPackages.size,
  bunPackages: bunPackages.size,
  added: [...bunPackages].filter(
    (name) => !name.includes('@workspace:') && !originalPackages.has(name),
  ),
  omitted: [...originalPackages].filter((name) => !bunPackages.has(name)),
};
if (lockAudit.added.length)
  throw new Error(`Bun lock contains changed package versions: ${lockAudit.added.join(', ')}`);
const baselinePnpmVersion = async () => {
  const prefix = 'pitchcrew-bun-version-';
  const directory = await mkdtemp(join(tmpdir(), prefix));
  try {
    // pnpm's launcher selects packageManager from cwd, so probing outside this tree is misleading.
    await writeFile(join(directory, 'package.json'), originalFiles.get('package.json')!);
    const version = (await command(executables.pnpm, ['--version'], directory)).stdout.trim();
    if (`pnpm@${version}` !== originalRoot.packageManager)
      throw new Error(
        `pnpm baseline version does not match ${String(originalRoot.packageManager)}.`,
      );
    return version;
  } finally {
    await cleanup(directory, prefix);
  }
};
const results = {
  generatedAt: new Date().toISOString(),
  baselineCommit: baseline,
  workingDiffSha256: hash(await git('diff', '--binary')),
  machine: { platform: platform(), arch: arch(), release: release(), cpu: cpus()[0]?.model },
  versions: {
    node: (await command(executables.node, ['--version'])).stdout.trim(),
    bun: (await command(executables.bun, ['--version'])).stdout.trim(),
    pnpm: await baselinePnpmVersion(),
    pnpmLauncher: (await command(executables.pnpm, ['--version'], tmpdir())).stdout.trim(),
  },
  methodology: {
    runtime:
      'Fresh process and fresh isolated workspace per sample; alternating Node/Bun order; API-only direct createDaemon; deterministic unavailable adapter detection; all module imports included; ready and first authenticated compact snapshot measured from parent spawn; filesystem caches not flushed; RSS sampled immediately after first snapshot.',
    installs:
      'Fresh manifest-only workspace per sample, original committed pnpm manifests/lock versus current Bun manifests/lock; one unmeasured warmup per manager; alternating order; normal trusted lifecycle scripts; frozen locks; existing global package/Electron caches; no node_modules reuse.',
    limitations:
      'One local machine; wall-clock samples include subprocess/pipe scheduling; RSS is a point sample, not peak or long-duration memory; excludes Electron, Chromium startup and live runtime probes; install results do not establish GitHub-hosted CI speed.',
  },
  dependencyVersionSpecifiersUnchanged: true,
  additionalDirectEdges,
  lockAudit,
  lockHashes: {
    pnpm: hash(originalFiles.get('pnpm-lock.yaml')!),
    bun: hash(currentFiles.get('bun.lock')!),
  },
  runtimeSamples: [] as RuntimeSample[],
  installSamples: [] as InstallSample[],
  summary: {} as Record<string, unknown>,
  complete: false,
  error: null as string | null,
};
const save = async () => {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(results, null, 2)}\n`);
};
const availablePort = async () => {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
};
const runtimeSample = async (tool: Tool, repetition: number) => {
  const prefix = 'pitchcrew-bun-startup-';
  const directory = await mkdtemp(join(tmpdir(), prefix));
  const fixture = join(repository, 'scripts/performance/bun-migration/daemon.ts');
  const phases = new Map<string, { elapsedMs: number; data: Record<string, unknown> }>();
  try {
    const port = await availablePort();
    const args =
      tool === 'node'
        ? ['--import', 'tsx', fixture, directory, String(port)]
        : ['--no-env-file', '--no-install', fixture, directory, String(port)];
    const result = await command(executables[tool], args, repository, (line, elapsedMs) => {
      if (!line.startsWith('PITCHCREW_BUN_BENCHMARK ')) return;
      const data = JSON.parse(line.slice('PITCHCREW_BUN_BENCHMARK '.length)) as Record<
        string,
        unknown
      >;
      phases.set(String(data.phase), { elapsedMs, data });
    });
    const ready = phases.get('ready');
    const snapshot = phases.get('snapshot');
    if (!ready || !snapshot || typeof snapshot.data.rssBytes !== 'number')
      throw new Error('Missing daemon benchmark result.');
    results.runtimeSamples.push({
      tool,
      repetition,
      readyMs: ready.elapsedMs,
      snapshotMs: snapshot.elapsedMs,
      rssBytes: snapshot.data.rssBytes,
      totalProcessMs: result.elapsedMs,
      fixture: snapshot.data,
    });
    console.error(
      `runtime ${tool} ${repetition}: ready=${ready.elapsedMs.toFixed(1)}ms snapshot=${snapshot.elapsedMs.toFixed(1)}ms rss=${(snapshot.data.rssBytes / 1024 ** 2).toFixed(1)}MiB`,
    );
    await save();
  } finally {
    await cleanup(directory, prefix);
  }
};
const installSample = async (tool: InstallTool, repetition: number, warmup: boolean) => {
  const prefix = 'pitchcrew-bun-install-';
  const directory = await mkdtemp(join(tmpdir(), prefix));
  const files = tool === 'pnpm' ? originalFiles : currentFiles;
  try {
    for (const [path, contents] of files) {
      const target = join(directory, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, contents);
    }
    const lockName = tool === 'pnpm' ? 'pnpm-lock.yaml' : 'bun.lock';
    const before = await readFile(join(directory, lockName), 'utf8');
    const args =
      tool === 'pnpm'
        ? ['install', '--frozen-lockfile', '--reporter=append-only']
        : ['--no-env-file', 'install', '--frozen-lockfile'];
    const result = await command(executables[tool], args, directory);
    if (tool === 'pnpm' && !result.stdout.includes(`using pnpm v${results.versions.pnpm}`))
      throw new Error('The sampled pnpm installer did not report the verified baseline version.');
    if ((await readFile(join(directory, lockName), 'utf8')) !== before)
      throw new Error(`${tool} changed its frozen lockfile.`);
    results.installSamples.push({ tool, repetition, warmup, ...result });
    console.error(
      `install ${tool} ${warmup ? 'warmup' : repetition}: ${(result.elapsedMs / 1000).toFixed(3)}s`,
    );
    await save();
  } finally {
    await cleanup(directory, prefix);
  }
};

try {
  await save();
  for (let index = 0; index < runtimeRuns; index++)
    for (const tool of (index % 2 ? ['bun', 'node'] : ['node', 'bun']) as Tool[])
      await runtimeSample(tool, index + 1);
  await installSample('pnpm', 0, true);
  await installSample('bun', 0, true);
  for (let index = 0; index < installRuns; index++)
    for (const tool of (index % 2 ? ['bun', 'pnpm'] : ['pnpm', 'bun']) as InstallTool[])
      await installSample(tool, index + 1, false);
  const runtimeMedian = (tool: Tool, metric: 'readyMs' | 'snapshotMs' | 'rssBytes') =>
    median(
      results.runtimeSamples
        .filter((sample) => sample.tool === tool)
        .map((sample) => sample[metric]),
    );
  const installMedian = (tool: InstallTool) =>
    median(
      results.installSamples
        .filter((sample) => sample.tool === tool && !sample.warmup)
        .map((sample) => sample.elapsedMs),
    );
  results.summary = {
    readyMs: comparison(runtimeMedian('node', 'readyMs'), runtimeMedian('bun', 'readyMs')),
    firstSnapshotMs: comparison(
      runtimeMedian('node', 'snapshotMs'),
      runtimeMedian('bun', 'snapshotMs'),
    ),
    rssBytes: comparison(runtimeMedian('node', 'rssBytes'), runtimeMedian('bun', 'rssBytes')),
    freshWarmCacheInstallMs: comparison(installMedian('pnpm'), installMedian('bun')),
  };
  results.complete = true;
  await save();
  console.log(JSON.stringify({ output, ...results.summary }, null, 2));
} catch (error) {
  results.error = error instanceof Error ? error.message : String(error);
  await save();
  throw error;
}
