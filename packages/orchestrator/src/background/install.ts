import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { currentServiceSpec, nodeServiceHost } from './host.ts';
import { createBackgroundService, type BackgroundService } from './index.ts';
import { pathFor } from './paths.ts';
import type { DaemonSettings } from './settings.ts';
import type { ServiceHost } from './types.ts';

/** Build with the checkout's installed Vite, without a shell or a global package manager. */
async function buildServiceUi(repository: string) {
  const directory = join(repository, 'packages', 'ui');
  try {
    const require = createRequire(join(directory, 'package.json'));
    const cli = join(dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
    await promisify(execFile)(process.execPath, [cli, 'build'], {
      cwd: directory,
      timeout: 300_000,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    });
  } catch {
    throw new Error(
      'Could not build the production UI. Check the installed dependencies and try again.',
    );
  }
}

/** Packaged apps already have the UI; source launches build it only when it is missing. */
export async function installServiceWithUi(
  service: BackgroundService,
  host: ServiceHost,
  buildUi: (repository: string) => Promise<void> = buildServiceUi,
) {
  const { spec } = service;
  const index = pathFor(spec.platform).join(
    spec.repository,
    'packages',
    'ui',
    'dist',
    'index.html',
  );
  if (!(await host.readFile(index))) await buildUi(spec.repository);
  return (await service.install()).status;
}

/** Installs for the daemon's resolved folder and port, independent of shell defaults. */
export async function installBackgroundService(settings: DaemonSettings) {
  const spec = currentServiceSpec(settings);
  if (!spec) throw new Error('The background service supports Windows, macOS and Linux.');
  return installServiceWithUi(createBackgroundService(spec, nodeServiceHost), nodeServiceHost);
}
