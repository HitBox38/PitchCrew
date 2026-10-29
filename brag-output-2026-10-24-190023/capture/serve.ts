import { createDaemon } from '../../packages/orchestrator/src/server.ts';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = Number(process.env.PITCHCREW_CAPTURE_PORT ?? 14417);
const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-brag-app-'));
const daemon = await createDaemon({
  directory,
  port,
  dev: true,
  ui: 'built',
  seedSkills: false,
  analytics: null,
  runtimeAuthenticationChecks: false,
  runtimeUpdateChecks: false,
});
await daemon.service.loadExamples();
daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
await new Promise<void>((resolve) => daemon.http.listen(port, '127.0.0.1', resolve));
console.log(`Fictional app capture ready at ${daemon.url}`);
const stop = async () => { await daemon.close(); process.exit(0); };
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
