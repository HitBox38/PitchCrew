import { mergedPullRequestEvent, object, repository, runEvents } from './events.ts';
import type { EngineeringEvent } from './events.ts';
export const pages = async (
  read: GitHubRead,
  path: string,
  field?: string,
  stop?: (items: unknown[]) => boolean,
): Promise<unknown[]> => {
  const output: unknown[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await read(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const items = field ? object(data)[field] : data;
    if (!Array.isArray(items)) throw new Error('Unexpected GitHub response shape');
    output.push(...items);
    if (items.length < 100 || stop?.(items)) return output;
  }
  throw new Error('GitHub collection limit reached; narrow the lookback window');
};

export const collect = async (
  readSource: GitHubRead,
  since: Date,
  now: Date,
): Promise<EngineeringEvent[]> => {
  let requests = 0;
  const read: GitHubRead = async (path) => {
    if (++requests > 500)
      throw new Error('GitHub request budget reached; narrow the lookback window');
    return readSource(path);
  };
  const prefix = `repos/${repository}`;
  const metadata = object(await read(prefix));
  if (metadata.private !== false)
    throw new Error('Engineering collection requires public repository metadata');
  const runs = await pages(
    read,
    `${prefix}/actions/workflows/ci.yml/runs?created=${encodeURIComponent(`>=${since.toISOString()}`)}`,
    'workflow_runs',
  );
  const output: EngineeringEvent[] = [];
  for (const raw of runs) {
    const run = object(raw);
    if (run.status !== 'completed') continue;
    if (
      !Number.isSafeInteger(run.id) ||
      !Number.isSafeInteger(run.run_attempt) ||
      Number(run.run_attempt) < 1 ||
      Number(run.run_attempt) > 10
    )
      throw new Error('Unsupported GitHub run attempt');
    for (let attempt = 1; attempt <= Number(run.run_attempt); attempt++) {
      const path = `${prefix}/actions/runs/${run.id}/attempts/${attempt}`;
      const data = await read(path);
      const jobs = await pages(read, `${path}/jobs`, 'jobs');
      output.push(...runEvents(data, jobs));
    }
  }
  // Updated ordering includes old PRs merged during the collection window.
  const prs = await pages(
    read,
    `${prefix}/pulls?state=closed&sort=updated&direction=desc`,
    undefined,
    (items) => {
      const updated = object(items.at(-1)).updated_at;
      return typeof updated === 'string' && Date.parse(updated) < since.getTime();
    },
  );
  for (const pr of prs) {
    const item = mergedPullRequestEvent(pr);
    if (item) output.push(item);
  }
  return output.filter(
    (item) =>
      Date.parse(item.timestamp) >= since.getTime() && Date.parse(item.timestamp) <= now.getTime(),
  );
};

export const send = async (
  events: EngineeringEvent[],
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<void> => {
  if (!/^phc_[a-zA-Z0-9]+$/.test(token))
    throw new Error('A PostHog public project token is required');
  for (let start = 0; start < events.length; start += 100) {
    const response = await fetcher('https://eu.i.posthog.com/batch/', {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: token, batch: events.slice(start, start + 100) }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`PostHog capture failed (HTTP ${response.status})`);
  }
};

export type GitHubRead = (path: string) => Promise<unknown>;
const maxPages = 10;
