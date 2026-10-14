import { describe, expect, it, vi } from 'vitest';
import { createBackgroundService } from '../src/background/index.ts';
import { installServiceWithUi } from '../src/background/install.ts';
import { pathFor } from '../src/background/paths.ts';
import { fakeServiceHost, fixtureSpecs } from './helpers/service-host.ts';

describe.each(['windows', 'macos', 'linux'] as const)(
  'Settings service install on %s',
  (platform) => {
    const spec = fixtureSpecs[platform];
    const index = pathFor(platform).join(spec.repository, 'packages', 'ui', 'dist', 'index.html');

    it('builds a missing UI before installing for the workspace folder and port', async () => {
      const { host, files, calls } = fakeServiceHost(platform, spec);
      files.delete(index);
      const build = vi.fn(async (repository: string) => {
        expect(repository).toBe(spec.repository);
        expect(calls).toEqual([]);
        await host.writeFile(index, 'built UI');
      });
      const status = await installServiceWithUi(createBackgroundService(spec, host), host, build);
      expect(build).toHaveBeenCalledOnce();
      expect(status).toMatchObject({
        installed: true,
        enabled: true,
        directory: spec.directory,
        port: spec.port,
      });
    });

    it('uses an existing built UI and leaves an unchanged running service alone', async () => {
      const { host, manager } = fakeServiceHost(platform, spec);
      const build = vi.fn();
      const service = createBackgroundService(spec, host);
      await installServiceWithUi(service, host, build);
      const pid = manager.pid;
      await installServiceWithUi(service, host, build);
      expect(manager.pid).toBe(pid);
      expect(build).not.toHaveBeenCalled();
    });

    it('does not register the service after a build failure and permits retry', async () => {
      const { host, files, calls } = fakeServiceHost(platform, spec);
      files.delete(index);
      const service = createBackgroundService(spec, host);
      await expect(
        installServiceWithUi(service, host, async () => {
          throw new Error('Build failed.');
        }),
      ).rejects.toThrow('Build failed.');
      expect(calls).toEqual([]);
      const status = await installServiceWithUi(service, host, async () => {
        await host.writeFile(index, 'UI');
      });
      expect(status.installed).toBe(true);
    });
  },
);
