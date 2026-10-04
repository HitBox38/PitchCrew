import { posix } from 'node:path';
import { servicePath } from './environment.ts';
import { daemonArguments, launchdLabel, serviceFiles } from './paths.ts';
import { escapeXml, unescapeXml } from './quote.ts';
import type { Inspection, PlatformDriver, ServiceHost, ServiceSpec } from './types.ts';

export const launchAgentPath = (spec: ServiceSpec) =>
  posix.join(spec.home, 'Library', 'LaunchAgents', `${launchdLabel}.plist`);

const string = (value: string) => `<string>${escapeXml(value)}</string>`;

/** A per-user LaunchAgent; it loads at login and restarts after a failed exit. */
export function renderLaunchAgent(spec: ServiceSpec) {
  const args = [spec.node, ...daemonArguments(spec)].map((arg) => `    ${string(arg)}`).join('\n');
  const log = serviceFiles('macos', spec.directory).launchdLog;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- Created by pnpm service install. Remove it with pnpm service uninstall. -->
<plist version="1.0">
<dict>
  <key>Label</key>
  ${string(launchdLabel)}
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>WorkingDirectory</key>
  ${string(spec.repository)}
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    ${string(servicePath(spec))}
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>StandardOutPath</key>
  ${string(log)}
  <key>StandardErrorPath</key>
  ${string(log)}
</dict>
</plist>
`;
}

export function readProgramArguments(plist: string) {
  const array = /<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(plist)?.[1];
  if (array === undefined) return null;
  return [...array.matchAll(/<string>([\s\S]*?)<\/string>/g)]
    .map((match) => unescapeXml(match[1]))
    .slice(1);
}

/** launchctl uses disabled/enabled on newer macOS releases and true/false on older ones. */
export function launchAgentDisabled(output: string) {
  return output.split(/\r?\n/).some((line) => {
    const entry = /^\s*"([^"]+)"\s*=>\s*(disabled|true|1)\s*;?\s*$/.exec(line);
    return entry?.[1] === launchdLabel;
  });
}

/** Reads `launchctl print gui/<uid>/<label>` output for the service's own state and process. */
export function parseLaunchctlPrint(output: string) {
  const state = /^\s*state = (.+)$/m.exec(output)?.[1]?.trim() ?? '';
  const pid = Number(/^\s*pid = (\d+)$/m.exec(output)?.[1]);
  return {
    state,
    running: state === 'running',
    pid: Number.isInteger(pid) && pid > 0 ? pid : null,
  };
}

export function macosDriver(spec: ServiceSpec, host: ServiceHost): PlatformDriver {
  const file = launchAgentPath(spec);
  const domain = `gui/${spec.uid}`;
  const target = `${domain}/${launchdLabel}`;
  const required = async (...args: string[]) => {
    const result = await host.run('launchctl', args);
    if (result.code !== 0)
      throw new Error(
        `launchctl ${args[0]} failed: ${(result.stderr || result.stdout).trim() || `exit ${result.code}`}`,
      );
  };
  // bootout returns before launchd finishes removing the job; bootstrap fails until it has.
  const bootout = async () => {
    await required('bootout', target);
    for (let i = 0; i < 40; i++) {
      if ((await host.run('launchctl', ['print', target])).code !== 0) return;
      await host.sleep(250);
    }
    throw new Error('launchctl bootout timed out: the background service is still loaded.');
  };
  return {
    file,
    definition: file,
    render: () => renderLaunchAgent(spec),
    async inspect(): Promise<Inspection> {
      const plist = await host.readFile(file);
      const print = await host.run('launchctl', ['print', target]);
      const disabled = await host.run('launchctl', ['print-disabled', domain]);
      if (disabled.code !== 0)
        throw new Error(
          `launchctl print-disabled failed: ${(disabled.stderr || disabled.stdout).trim() || `exit ${disabled.code}`}`,
        );
      const enabled = !!plist && !launchAgentDisabled(disabled.stdout);
      const state = parseLaunchctlPrint(print.code === 0 ? print.stdout : '');
      return {
        installed: !!plist,
        enabled,
        loaded: print.code === 0,
        running: state.running,
        pid: state.pid,
        args: plist ? readProgramArguments(plist.toString('utf8')) : null,
        detail:
          print.code === 0
            ? `launchd reports ${state.state || 'no state'}.`
            : 'launchd has not loaded the agent.',
      };
    },
    async register(changed, before) {
      await required('enable', target);
      if (before.loaded && changed) await bootout();
      if (!before.loaded || changed) await required('bootstrap', domain, file);
      else if (!before.running) await required('kickstart', target);
    },
    async unregister(before) {
      if (before.loaded) await bootout();
      await host.remove(file);
    },
    async start(before) {
      if (before.loaded) await required('kickstart', target);
      else await required('bootstrap', domain, file);
    },
    // Unloading keeps KeepAlive from restarting the daemon; the agent loads again at next login.
    async stop(before) {
      if (before.loaded) await bootout();
    },
  };
}
