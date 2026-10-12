import { describe, expect, it, vi } from 'vitest';
import { collect, pages, send } from '../../../scripts/engineering-analytics/collector.ts';
import {
  mergedPullRequestEvent,
  runEvents,
} from '../../../scripts/engineering-analytics/events.ts';

const run = {
  id: 123,
  run_attempt: 1,
  name: 'CI',
  status: 'completed',
  conclusion: 'success',
  event: 'pull_request',
  head_sha: 'private-sha',
  actor: { login: 'private-identity' },
};
const job = {
  id: 456,
  name: 'Lint, format, types and build',
  status: 'completed',
  conclusion: 'success',
  started_at: '2026-10-12T12:00:00Z',
  completed_at: '2026-10-12T12:05:00Z',
  runner_name: 'private-runner',
  steps: [
    {
      number: 4,
      name: 'Build public landing page',
      status: 'completed',
      conclusion: 'success',
      started_at: '2026-10-12T12:01:00Z',
      completed_at: '2026-10-12T12:02:00Z',
    },
  ],
};
const pr = {
  number: 1,
  draft: false,
  base: { ref: 'dev' },
  user: { type: 'User', login: 'private-identity' },
  title: 'private-title',
  body: 'private-body',
  created_at: '2026-10-10T12:00:00Z',
  merged_at: '2026-10-12T12:00:00Z',
  updated_at: '2026-10-12T12:00:00Z',
};

describe('content-free engineering analytics', () => {
  it('uses real job and step timings with stable attempt-specific event UUIDs', () => {
    const events = runEvents(run, [job]);
    expect(events.map((item) => item.event)).toEqual([
      'pitchcrew_ci_run_completed',
      'pitchcrew_ci_job_completed',
      'pitchcrew_ci_step_completed',
    ]);
    expect(events[0]?.properties.job_span_seconds).toBe(300);
    expect(events[2]?.properties.duration_seconds).toBe(60);
    expect(events).toEqual(runEvents(run, [job]));
    expect(events[0]?.uuid).not.toEqual(runEvents({ ...run, run_attempt: 2 }, [job])[0]?.uuid);
    expect(events[0]?.uuid).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    );
  });
  it('drops private names, actors, SHA, PR text and unsupported command names', () => {
    const events = [
      ...runEvents(run, [
        job,
        {
          ...job,
          id: 999,
          name: 'private-job',
          steps: [{ ...job.steps[0], name: 'private-command' }],
        },
      ]),
      mergedPullRequestEvent(pr),
    ];
    expect(JSON.stringify(events)).not.toContain('private-');
    expect(events.every((item) => item?.properties.$process_person_profile === false)).toBe(true);
    expect(events[3]?.properties.job).toBe('other');
  });
  it('does not emit running, release or malformed timing events', () => {
    expect(runEvents({ ...run, status: 'in_progress' }, [job])).toEqual([]);
    expect(runEvents({ ...run, name: 'Release' }, [job])).toEqual([]);
    expect(runEvents(run, [{ ...job, started_at: 'invalid', completed_at: null }])).toEqual([]);
    expect(
      runEvents(run, [{ ...job, started_at: '2026-10-12T13:00:00Z' }]).filter(
        (item) => item.event === 'pitchcrew_ci_job_completed',
      ),
    ).toEqual([]);
  });
  it('treats prototype property names as unknown classes rather than allowlisted labels', () => {
    const events = runEvents(run, [
      { ...job, name: 'constructor', steps: [{ ...job.steps[0], name: 'toString' }] },
    ]);
    expect(events.map((item) => item.event)).toEqual([
      'pitchcrew_ci_run_completed',
      'pitchcrew_ci_job_completed',
    ]);
    expect(events[1]?.properties.job).toBe('other');
  });
  it('measures PR open-to-merge time and excludes bots/drafts and unknown branches', () => {
    expect(mergedPullRequestEvent(pr)?.properties.open_to_merge_seconds).toBe(172800);
    for (const user of [
      { type: 'Bot', login: 'bot' },
      { type: 'User', login: 'agent[bot]' },
      { type: 'User', login: 'renovate' },
    ])
      expect(mergedPullRequestEvent({ ...pr, user })).toBeUndefined();
    expect(mergedPullRequestEvent({ ...pr, draft: true })).toBeUndefined();
    expect(mergedPullRequestEvent({ ...pr, base: { ref: 'private-branch' } })).toBeUndefined();
  });
  it('reads all attempts and stops PR pagination after the collection window', async () => {
    const read = vi.fn(async (path: string) => {
      if (path === 'repos/HitBox38/PitchCrew') return { private: false };
      if (path.includes('/workflows/')) return { workflow_runs: [{ ...run, run_attempt: 2 }] };
      if (path.includes('/jobs')) return { jobs: [job] };
      if (path.includes('/attempts/')) return { ...run, run_attempt: path.endsWith('/2') ? 2 : 1 };
      return [pr];
    });
    const events = await collect(read, new Date('2026-10-11'), new Date('2026-10-13'));
    expect(events).toHaveLength(7);
    expect(read.mock.calls.some(([path]) => path.includes('/attempts/2/jobs'))).toBe(true);
    const olderPrs = Array.from({ length: 100 }, () => ({ ...pr, updated_at: '2020-01-01' }));
    const paged = vi.fn(async () => olderPrs);
    expect(
      await pages(
        paged,
        'pulls',
        undefined,
        (items) => String((items.at(-1) as typeof pr).updated_at) < '2026',
      ),
    ).toHaveLength(100);
    expect(paged).toHaveBeenCalledTimes(1);
  });
  it('fails rather than silently claiming a complete backfill at the hard page cap', async () => {
    await expect(pages(async () => Array.from({ length: 100 }, () => pr), 'pulls')).rejects.toThrow(
      'limit reached',
    );
  });
  it('refuses private repository metadata before reading CI or PR records', async () => {
    const read = vi.fn(async () => ({ private: true }));
    await expect(collect(read, new Date('2026-10-11'), new Date('2026-10-13'))).rejects.toThrow(
      'public repository',
    );
    expect(read).toHaveBeenCalledTimes(1);
    await expect(pages(async () => ({ unexpected: [] }), 'runs', 'workflow_runs')).rejects.toThrow(
      'response shape',
    );
  });
  it('only accepts public project tokens and posts bounded batches to fixed EU capture', async () => {
    const events = runEvents(run, [job]);
    const fetcher = vi.fn<typeof fetch>(async () => new Response('{}', { status: 200 }));
    await expect(send(events, 'phx_personal-key', fetcher)).rejects.toThrow('public project token');
    expect(fetcher).not.toHaveBeenCalled();
    await send(
      Array.from({ length: 101 }, () => events[0]!),
      'phc_test123',
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://eu.i.posthog.com/batch/');
    expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe('error');
    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string);
    expect(body.batch).toHaveLength(100);
    expect(body.batch[0].uuid).toBe(events[0]?.uuid);
    await expect(
      send(
        events,
        'phc_test123',
        async () => new Response('private-server-error', { status: 500 }),
      ),
    ).rejects.toThrow('HTTP 500');
  });
});
