import { fork, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { cpus, platform, release, tmpdir, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { dependencyFootprint } from './dependencies.mjs';
import { firstSse, load, quietLatency } from './metrics.mjs';
import { median, memory, message, percentile, stop } from './process.mjs';

// Install autocannon outside the app, and pass its module path; production dependencies stay unchanged.
const [baselineArg, candidateArg, autocannonArg, outputArg, roundsArg = '5', durationArg = '5'] =
  process.argv.slice(2);
if (!baselineArg || !candidateArg || !autocannonArg || !outputArg)
  throw new Error(
    'Usage: node scripts/benchmarks/http.mjs BASELINE CANDIDATE AUTOCANNON_MODULE OUTPUT [ROUNDS=5] [SECONDS=5]',
  );
const rounds = Number(roundsArg),
  duration = Number(durationArg);
if (!Number.isInteger(rounds) || rounds < 1 || !Number.isInteger(duration) || duration < 1)
  throw new Error('Rounds and duration must be positive integers.');
const require = createRequire(import.meta.url);
const autocannon = require(resolve(autocannonArg));
const root = await mkdtemp(join(tmpdir(), 'pitchcrew-http-bench-'));
const seed = join(root, 'seed'),
  data = join(root, 'data');
const runner = fileURLToPath(new URL('./daemon.mjs', import.meta.url));
const variants = [
  { name: 'express', root: resolve(baselineArg) },
  { name: 'fastify', root: resolve(candidateArg) },
];
const revision = (cwd) => {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
};
const loader = (cwd) => createRequire(join(cwd, 'package.json')).resolve('tsx');
const report = {
  timestamp: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: platform(),
    release: release(),
    architecture: process.arch,
    cpu: cpus()[0].model,
    logicalCpus: cpus().length,
    ramBytes: totalmem(),
    autocannon: require(join(resolve(autocannonArg), 'package.json')).version,
  },
  methodology: {
    rounds,
    measuredSeconds: duration,
    warmupSeconds: 1,
    connections: [1, 16],
    pipelining: 1,
    frameworkOrder: 'Alternating within paired rounds; one daemon at a time',
    startup:
      'Parent process spawn to daemon listening/ready IPC; warm OS/module caches; includes native CLI health detection',
    memory:
      'Median of five IPC process.memoryUsage samples 100 ms apart; warmed after 20 full snapshots; no forced GC',
    fixture: { cards: 100, messages: 200, profileNotes: 2, roles: 3 },
    quietLatency:
      '300 serial keep-alive responses per endpoint per round after 10 connection warmups; high-resolution parent performance.now to response end; no other load',
    sse: '100 sequential fresh connections per round; time to complete first saved-state event; no generated tokens',
    footprint:
      'Unique installed third-party production dependency closure including installed optional dependencies; sum of logical file lengths excluding nested node_modules and symlinks; excludes workspace sources, dev dependencies and Electron; not packaged app size',
  },
  variants: [],
  trials: [],
  summary: {},
};
async function cleanup() {
  if (
    dirname(root) !== resolve(tmpdir()) ||
    !root.startsWith(join(resolve(tmpdir()), 'pitchcrew-http-bench-'))
  )
    throw new Error('Refusing unsafe benchmark cleanup');
  await rm(root, { recursive: true, force: true });
}
let running;
try {
  await mkdir(seed, { recursive: true });
  const seeded = spawnSync(
    process.execPath,
    ['--import', loader(variants[1].root), runner, 'seed', variants[1].root, seed],
    { cwd: variants[1].root, encoding: 'utf8' },
  );
  if (seeded.status !== 0) throw new Error(seeded.stderr);
  for (const variant of variants)
    report.variants.push({
      name: variant.name,
      revision: revision(variant.root),
      dependencyFootprint: await dependencyFootprint(variant.root),
    });
  const workloads = ['/api/health', '/api/routines', '/api/snapshot'].flatMap((path) =>
    [1, 16].map((connections) => ({ path, connections })),
  );
  for (let round = 0; round < rounds; round++) {
    for (const variant of round % 2 ? [...variants].reverse() : variants) {
      await rm(data, { recursive: true, force: true });
      await cp(seed, data, { recursive: true });
      const start = performance.now();
      running = fork(runner, ['serve', variant.root, data, '14621'], {
        cwd: variant.root,
        execArgv: ['--import', loader(variant.root)],
        env: { ...process.env, PITCHCREW_SEED_SKILLS: '0' },
        silent: true,
      });
      running.stderr.on('data', (chunk) => process.stderr.write(chunk));
      const { url } = await message(running, (value) => value.type === 'ready');
      const startupMs = performance.now() - start;
      const page = await fetch(url);
      const cookie = page.headers.get('set-cookie')?.split(';')[0];
      if (!cookie) throw new Error('Missing benchmark session cookie');
      const headers = { cookie, 'x-pitchcrew-client': 'ui' };
      let snapshotBytes;
      for (let i = 0; i < 20; i++) {
        const response = await fetch(`${url}/api/snapshot`, { headers });
        const body = await response.text();
        const state = JSON.parse(body);
        if (
          response.status !== 200 ||
          state.cards.length !== 100 ||
          state.messages.length !== 200 ||
          state.profile.length !== 2
        )
          throw new Error('Unexpected benchmark snapshot');
        snapshotBytes = Buffer.byteLength(body);
      }
      const trial = {
        framework: variant.name,
        round: round + 1,
        startupMs,
        snapshotBytes,
        warmedMemory: await memory(running),
        workloads: [],
      };
      console.log(
        JSON.stringify({
          framework: variant.name,
          round: round + 1,
          startupMs: Math.round(startupMs),
          snapshotBytes,
        }),
      );
      for (const workload of round % 2 ? [...workloads].reverse() : workloads) {
        const options = {
          url: `${url}${workload.path}`,
          headers,
          connections: workload.connections,
          pipelining: 1,
          duration,
          timeout: 10,
        };
        await load(autocannon, { ...options, duration: 1 });
        const result = await load(autocannon, options);
        const measured = {
          ...workload,
          durationSeconds: result.duration,
          requests: result.requests.total,
          requestsPerSecond: result.requests.average,
          meanLatencyMs: result.latency.average,
          p50LatencyMs: result.latency.p50,
          p99LatencyMs: result.latency.p99,
          errors: result.errors,
          timeouts: result.timeouts,
          non2xx: result.non2xx,
        };
        if (workload.connections === 1)
          measured.quietLatency = await quietLatency(options.url, headers);
        trial.workloads.push(measured);
        console.log(JSON.stringify({ framework: variant.name, round: round + 1, ...measured }));
      }
      const samples = [];
      for (let i = 0; i < 100; i++) samples.push(await firstSse(url, headers));
      trial.sse = {
        samples: samples.length,
        p50Ms: percentile(samples, 0.5),
        p99Ms: percentile(samples, 0.99),
        samplesMs: samples,
      };
      trial.afterLoadMemory = await memory(running);
      report.trials.push(trial);
      await stop(running);
      running = undefined;
      await writeFile(resolve(outputArg), JSON.stringify(report, null, 2) + '\n');
    }
  }
  for (const variant of variants) {
    const trials = report.trials.filter((x) => x.framework === variant.name);
    report.summary[variant.name] = {
      startupMs: median(trials.map((x) => x.startupMs)),
      warmedRssBytes: median(trials.map((x) => x.warmedMemory.rssBytes)),
      warmedHeapBytes: median(trials.map((x) => x.warmedMemory.heapUsedBytes)),
      afterLoadRssBytes: median(trials.map((x) => x.afterLoadMemory.rssBytes)),
      sseP50Ms: median(trials.map((x) => x.sse.p50Ms)),
      sseP99Ms: median(trials.map((x) => x.sse.p99Ms)),
      workloads: workloads.map((workload) => {
        const samples = trials.map((trial) =>
          trial.workloads.find(
            (x) => x.path === workload.path && x.connections === workload.connections,
          ),
        );
        return {
          ...workload,
          requestsPerSecond: median(samples.map((x) => x.requestsPerSecond)),
          meanLatencyMs: median(samples.map((x) => x.meanLatencyMs)),
          p99LatencyMs: median(samples.map((x) => x.p99LatencyMs)),
          ...(workload.connections === 1
            ? {
                quietP50Ms: median(samples.map((x) => x.quietLatency.p50Ms)),
                quietP99Ms: median(samples.map((x) => x.quietLatency.p99Ms)),
              }
            : {}),
          requestsPerSecondRange: [
            Math.min(...samples.map((x) => x.requestsPerSecond)),
            Math.max(...samples.map((x) => x.requestsPerSecond)),
          ],
        };
      }),
    };
  }
  await writeFile(resolve(outputArg), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.summary, null, 2));
} finally {
  if (running) await stop(running);
  await cleanup();
}
