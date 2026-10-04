import type { BackgroundServiceStatus } from '@pitchcrew/core';
import { uptime } from 'node:os';
import { linuxDriver } from './linux.ts';
import { lockHeld, parseDaemonLock } from './lock.ts';
import { macosDriver } from './macos.ts';
import { installedLocation, pathFor, samePath, serviceFiles } from './paths.ts';
import type { ServiceHost, ServiceSpec } from './types.ts';
import { windowsDriver } from './windows.ts';

export type { ServiceHost, ServiceSpec } from './types.ts';

const drivers = { windows: windowsDriver, macos: macosDriver, linux: linuxDriver };

/** Install, inspect and control the per-user background service for one platform. */
export function createBackgroundService(spec: ServiceSpec, host: ServiceHost) {
  const driver = drivers[spec.platform](spec, host);
  const files = (directory: string) => serviceFiles(spec.platform, directory);
  const checks = {
    isAlive: (pid: number) => host.isAlive(pid),
    answers: (port: number) => host.answers(port),
    now: () => Date.now(),
    bootTime: () => Date.now() - uptime() * 1000,
  };

  async function lockHolder(directory: string) {
    const lock = parseDaemonLock((await host.readFile(files(directory).lock))?.toString() ?? '');
    return lock && (await lockHeld(lock, checks)) ? lock : null;
  }

  async function inspect() {
    const before = await driver.inspect();
    const location = installedLocation(before.args);
    const directory = location.directory ?? spec.directory;
    const holder = await lockHolder(directory);
    return { before, location, directory, holder, servicePid: holder?.service ? holder.pid : null };
  }

  async function status(): Promise<BackgroundServiceStatus> {
    const { before, location, directory, holder, servicePid } = await inspect();
    const running = before.installed && (before.running ?? servicePid !== null);
    const waiting = before.installed && holder && !holder.service;
    return {
      platform: spec.platform,
      installed: before.installed,
      enabled: before.enabled,
      running,
      pid: running ? (before.pid ?? servicePid) : null,
      directory: location.directory,
      port: location.port,
      definition: before.installed ? driver.definition : null,
      logFile: before.installed ? files(directory).log : null,
      detail: waiting
        ? `${before.detail} Another daemon (process ${holder.pid}) is using the data folder, so the service waits for it to stop.`
        : before.detail,
    };
  }

  async function assertInstallable() {
    const path = pathFor(spec.platform);
    if (!(await host.readFile(path.join(spec.repository, 'packages', 'ui', 'dist', 'index.html'))))
      throw new Error(
        'Build the UI first with pnpm build. The background service runs the production daemon.',
      );
    // Task Scheduler expands %NAME% in arguments and offers no escape for a literal percent sign.
    if (
      spec.platform === 'windows' &&
      [spec.node, spec.cli, spec.directory, spec.repository].some((value) => value.includes('%'))
    )
      throw new Error('Task Scheduler cannot run paths that contain a percent sign (%).');
  }

  async function installed() {
    const current = await inspect();
    if (!current.before.installed)
      throw new Error('The background service is not installed. Run pnpm service install.');
    return current;
  }

  return {
    spec,
    status,
    /** Writes and registers the definition; running it again applies new settings. */
    async install() {
      await assertInstallable();
      const current = await inspect();
      const content = driver.render();
      const previous = await host.readFile(driver.file);
      const same = !!previous && previous.equals(Buffer.from(content));
      if (!same) await host.writeFile(driver.file, content);
      await host.makeFolder(files(spec.directory).folder);
      const moved =
        current.location.directory &&
        !samePath(spec.platform, current.location.directory, spec.directory);
      if (moved && spec.platform === 'windows')
        await host.remove(files(current.location.directory!).task);
      const changed = !same || !current.before.installed || !!moved;
      try {
        await driver.register(changed, current.before, current.servicePid);
      } catch (error) {
        // Leave the previous definition, or none, rather than one the manager never accepted.
        if (!same)
          await (previous ? host.writeFile(driver.file, previous) : host.remove(driver.file));
        throw error;
      }
      const holder = await lockHolder(spec.directory);
      const notes =
        holder && !holder.service
          ? [
              `Another Pitchcrew daemon (process ${holder.pid}) is using this data folder. The background service starts after it stops.`,
            ]
          : [];
      return { changed, notes, status: await status() };
    },
    /** Stops the service and removes its definition, task file and logs. */
    async uninstall() {
      const current = await inspect();
      await driver.unregister(current.before, current.servicePid);
      const folders = [current.location.directory, spec.directory]
        .filter((directory): directory is string => !!directory)
        .filter(
          (directory, index, all) =>
            all.findIndex((other) => samePath(spec.platform, other, directory)) === index,
        )
        .map((directory) => files(directory).folder);
      for (const folder of folders) await host.remove(folder);
      return { removed: [...(current.before.installed ? [driver.definition] : []), ...folders] };
    },
    async start() {
      const current = await installed();
      await driver.start(current.before);
    },
    async stop() {
      const current = await installed();
      await driver.stop(current.before, current.servicePid);
    },
    /** The newest lines from the service logs. */
    async logs(lines = 200) {
      const { directory } = await inspect();
      const log = files(directory);
      const sources = [
        log.previousLog,
        log.log,
        ...(spec.platform === 'macos' ? [log.launchdLog] : []),
      ];
      const found: string[] = [];
      let text = '';
      for (const source of sources) {
        const content = await host.readFile(source);
        if (!content) continue;
        found.push(source);
        text += content.toString('utf8');
      }
      return { files: found, text: text.split(/\r?\n/).filter(Boolean).slice(-lines).join('\n') };
    },
  };
}

export type BackgroundService = ReturnType<typeof createBackgroundService>;
