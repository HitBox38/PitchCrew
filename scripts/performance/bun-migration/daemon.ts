/** Deterministic daemon fixture. Only the benchmark driver starts this file. */
import { adapters } from '../../../packages/adapters/src/index.ts';
import { createDaemon } from '../../../packages/orchestrator/src/server.ts';

const directory = process.argv[2];
const port = Number(process.argv[3]);
if (!directory || !Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('The benchmark requires an isolated directory and loopback port.');
for (const adapter of Object.values(adapters))
  adapter.detect = async () => ({
    id: adapter.id,
    available: false,
    version: '',
    detail: 'Deterministic unavailable runtime for the isolated performance fixture.',
  });

const daemon = await createDaemon({ directory, port, ui: false, seedSkills: false });
const emit = (value: Record<string, unknown>) =>
  console.log(`PITCHCREW_BUN_BENCHMARK ${JSON.stringify(value)}`);
try {
  await new Promise<void>((resolve, reject) => {
    daemon.http.once('error', reject);
    daemon.http.listen(port, '127.0.0.1', () => {
      daemon.http.off('error', reject);
      resolve();
    });
  });
  emit({ phase: 'ready', fixtureElapsedMs: performance.now() });
  const session = await fetch(daemon.url);
  const cookie = session.headers.get('set-cookie')?.split(';')[0];
  await session.arrayBuffer();
  if (!cookie) throw new Error('The fixture did not receive a local session.');
  const response = await fetch(`${daemon.url}/api/snapshot?view=workspace`, {
    headers: { cookie, 'x-pitchcrew-client': 'ui' },
  });
  if (!response.ok) throw new Error(`Snapshot failed: ${response.status}`);
  const snapshot = (await response.json()) as { roles?: unknown[] };
  if (!snapshot.roles?.length) throw new Error('The fixture returned no seeded roles.');
  emit({
    phase: 'snapshot',
    fixtureElapsedMs: performance.now(),
    rssBytes: process.memoryUsage().rss,
    roleCount: snapshot.roles.length,
    node: process.versions.node,
    bun: process.versions.bun ?? null,
  });
} finally {
  await daemon.close();
}
