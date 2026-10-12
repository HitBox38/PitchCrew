import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { collect, send } from './collector.ts';
import { repository } from './events.ts';

const exec = promisify(execFile);
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--send'))
  throw new Error('Usage: node scripts/engineering-analytics/index.ts [--send]');
const sending = args.includes('--send');
if (sending && process.env.PITCHCREW_ENGINEERING_ANALYTICS !== '1')
  throw new Error('Repository engineering analytics must be explicitly enabled');
if (sending && !process.env.PITCHCREW_ENGINEERING_POSTHOG_TOKEN)
  throw new Error('A PostHog public project token is required');
if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_REPOSITORY !== repository)
  throw new Error('Engineering collector is scoped to HitBox38/PitchCrew');
const now = new Date();
const days = Number(process.env.PITCHCREW_ENGINEERING_LOOKBACK_DAYS ?? 7);
if (!Number.isInteger(days) || days < 1 || days > 30)
  throw new Error('Lookback must be between 1 and 30 days');
const events = await collect(
  async (path) => {
    try {
      const { stdout } = await exec('gh', ['api', '--hostname', 'github.com', path], {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      });
      return JSON.parse(stdout) as unknown;
    } catch {
      throw new Error(
        'GitHub metadata read failed; check gh authentication and read-only repository permissions',
      );
    }
  },
  new Date(now.getTime() - days * 86400000),
  now,
);
if (sending) await send(events, process.env.PITCHCREW_ENGINEERING_POSTHOG_TOKEN!);
console.log(
  JSON.stringify({
    mode: sending ? 'sent' : 'dry_run',
    lookback_days: days,
    event_counts: Object.fromEntries(
      [...new Set(events.map((item) => item.event))].map((name) => [
        name,
        events.filter((item) => item.event === name).length,
      ]),
    ),
  }),
);
