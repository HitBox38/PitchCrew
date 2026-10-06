import { adapters } from '../packages/adapters/src/index.ts';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createDaemon } from '../packages/orchestrator/src/server.ts';

// Keep the production daemon and built UI under test without invoking any provider CLI.
const directory = resolve(process.env.PITCHCREW_HOME);
if (!directory.startsWith(resolve(tmpdir(), 'pitchcrew-electron-check-')))
  throw new Error('The desktop fixture daemon requires an isolated temporary workspace.');
for (const adapter of Object.values(adapters))
  adapter.detect = async () => ({
    id: adapter.id,
    available: adapter.id === 'claude-code',
    version: 'Fixture',
    detail: 'Isolated desktop test fixture.',
  });
adapters['claude-code'].chat = adapters.demo.chat;
adapters['claude-code'].listModels = async () => adapters['claude-code'].models;
const port = Number(process.env.PITCHCREW_PORT);
const daemon = await createDaemon({
  directory,
  port,
  seedSkills: false,
  updates: {
    enabled: true,
    automatic: true,
    current: { version: '0.1.0', commit: 'a'.repeat(40), packaged: true },
    fetcher: async (url) =>
      new Response(
        JSON.stringify(
          String(url).includes('/releases/')
            ? { tag_name: 'build-' + 'b'.repeat(40), draft: false, prerelease: false }
            : { status: 'ahead' },
        ),
      ),
  },
});
for (const role of daemon.service.board.list('role'))
  await daemon.service.configureRole(role.id, { ...role, enabled: true });
// Reproduce a role retained from development without enabling Demo in the production daemon.
const writer = daemon.service.board.get('role', 'writer');
daemon.service.board.record(
  'role',
  { ...writer, runtime: 'demo', model: '', reasoning: null },
  'user',
  'Retained development role fixture',
);
await new Promise((resolve) => daemon.http.listen(port, '127.0.0.1', resolve));
console.log(`Desktop fixture daemon ready at ${daemon.url}`);
let closing = false;
const stop = async () => {
  if (closing) return;
  closing = true;
  await daemon.close();
  process.exit(0);
};
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
