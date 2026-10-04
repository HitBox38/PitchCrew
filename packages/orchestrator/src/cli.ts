import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDaemon } from './server.ts';
import { assertDataDirectoryOutsideRepository } from './data-directory.ts';

const port = Number(process.env.PITCHCREW_PORT ?? 4417);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('PITCHCREW_PORT must be between 1024 and 65535.');
const directory = resolve(process.env.PITCHCREW_HOME ?? join(homedir(), '.pitchcrew'));
const root = fileURLToPath(new URL('../../../', import.meta.url));
assertDataDirectoryOutsideRepository(root, directory);
const daemon = await createDaemon({
  directory,
  port,
  dev: process.argv.includes('--dev'),
  seedSkills: process.env.PITCHCREW_SEED_SKILLS !== '0',
});
daemon.http.on('error', async (error) => {
  console.error(error.message);
  await daemon.close();
  process.exitCode = 1;
});
daemon.http.listen(port, '127.0.0.1', () =>
  console.log(`Pitchcrew is ready at ${daemon.url}\nLocal data: ${directory}`),
);
let closing = false;
const stop = async () => {
  if (closing) return;
  closing = true;
  await daemon.close();
  process.exit(0);
};
process.on('SIGINT', () => {
  void stop();
});
process.on('SIGTERM', () => {
  void stop();
});
