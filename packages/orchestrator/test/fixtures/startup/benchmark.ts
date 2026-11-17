// Offline Bun startup benchmark. Fresh process per invocation; no UI or native runtime calls.
// bun --no-env-file --no-install packages/orchestrator/test/fixtures/startup/benchmark.ts
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const started = performance.now();
const { createDaemon } = await import('../../../src/server.ts');
const importMs = performance.now() - started;
const { Board } = await import('@pitchcrew/board');
const { adapters } = await import('@pitchcrew/adapters');
const { RuntimeMaintenanceStore } = await import('../../../src/runtime-maintenance/store.ts');
const { runtimeMaintenanceHost } = await import('../../../src/runtime-maintenance/index.ts');
const { startupRuntimes, startupInstallation, startupUpdates } = await import('./maintenance.ts');
const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-test-startup-benchmark-'));
const holder = createServer();
let daemon: Awaited<ReturnType<typeof createDaemon>> | undefined;
const originalFetch = globalThis.fetch;
try {
  // Reject unexpected network activity, including accidental telemetry.
  globalThis.fetch = (() => {
    throw new Error('Benchmark network access denied.');
  }) as typeof fetch;
  for (const adapter of Object.values(adapters)) {
    adapter.detect = async () => ({
      id: adapter.id,
      available: false,
      version: '',
      detail: 'Fixture',
    });
    adapter.listModels = async () => {
      throw new Error('Benchmark native discovery denied.');
    };
    adapter.run = async () => {
      throw new Error('Benchmark runtime execution denied.');
    };
    adapter.chat = async () => {
      throw new Error('Benchmark runtime execution denied.');
    };
  }
  const board = new Board(join(directory, 'pitchcrew.db'));
  board.seedRoles('claude-code', false);
  board.close();
  const store = new RuntimeMaintenanceStore(directory);
  store.state.updates = startupUpdates();
  store.state.identities = Object.fromEntries(
    startupRuntimes.map((id) => [id, startupInstallation(id).identity]),
  );
  store.save();
  let active = 0,
    maxActive = 0,
    calls = 0;
  runtimeMaintenanceHost.resolve = async (id) => {
    calls++;
    maxActive = Math.max(maxActive, ++active);
    await new Promise((resolve) => setTimeout(resolve, 200));
    active--;
    return startupInstallation(id);
  };
  await new Promise<void>((resolve) => holder.listen(0, '127.0.0.1', resolve));
  const { port } = holder.address() as AddressInfo;
  const preparation = performance.now();
  daemon = await createDaemon({ directory, port, ui: false, seedSkills: false });
  await new Promise<void>((resolve) => holder.close(() => resolve()));
  await new Promise<void>((resolve) => daemon!.http.listen(port, '127.0.0.1', resolve));
  const readyMs = performance.now() - preparation;
  const health = await daemon.app.inject({
    url: '/api/health',
    headers: { host: `127.0.0.1:${port}` },
  });
  if (health.statusCode !== 200 || (await daemon.service.snapshot()).roles.length !== 8)
    throw new Error('Workspace not ready.');
  console.log(
    JSON.stringify({
      import_ms: Math.round(importMs),
      preparation_ms: Math.round(readyMs),
      lookup_ms: 200,
      calls,
      max_active: maxActive,
    }),
  );
} finally {
  if (holder.listening) holder.close();
  await daemon?.close();
  globalThis.fetch = originalFetch;
  await rm(directory, { recursive: true, force: true });
}
