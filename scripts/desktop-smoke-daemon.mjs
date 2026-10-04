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
const port = Number(process.env.PITCHCREW_PORT);
const daemon = await createDaemon({ directory, port, seedSkills: false });
for (const role of daemon.service.board.list('role'))
  await daemon.service.configureRole(role.id, { ...role, enabled: true });
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
