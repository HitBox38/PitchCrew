import { createDaemon } from '../../src/server.ts';
import { adapters } from '../../../adapters/src/index.ts';
import { defaultCapabilities } from '../../../core/src/index.ts';
import { browserE2EChat } from '../../../mcp/test/fixtures/browser-e2e-agent.ts';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFile } from 'node:fs/promises';

const directory = resolve(process.env.PITCHCREW_HOME ?? '');
if (!directory.startsWith(resolve(tmpdir(), 'pitchcrew-browser-e2e-')))
  throw new Error('Browser E2E requires an isolated temporary workspace.');
// Only the provider is deterministic. Browser launch, HTTP, MCP and policy stay real.
for (const adapter of Object.values(adapters))
  adapter.detect = async () => ({
    id: adapter.id,
    available: adapter.id === 'demo',
    version: 'E2E fixture',
    detail: 'No provider processes or credentials.',
  });
adapters.demo.chat = browserE2EChat;
const port = Number(process.env.PITCHCREW_PORT);
const daemon = await createDaemon({ directory, port, dev: true, ui: 'built', seedSkills: false });
for (const role of daemon.service.board.list<import('../../../core/src/index.ts').Role>('role'))
  await daemon.service.configureRole(role.id, {
    ...role,
    runtime: 'demo',
    model: '',
    reasoning: null,
    enabled: true,
    capabilities: { ...defaultCapabilities, ...role.capabilities, computerUse: true },
  });
await new Promise<void>((ready) => daemon.http.listen(port, '127.0.0.1', ready));
await writeFile(join(directory, 'ready.json'), JSON.stringify({ url: daemon.url }));
let closing = false;
const stop = async () => {
  if (closing) return;
  closing = true;
  await daemon.close();
};
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
