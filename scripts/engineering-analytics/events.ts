import { createHash } from 'node:crypto';

export const repository = 'HitBox38/PitchCrew';
const conclusions = new Set([
  'success',
  'failure',
  'cancelled',
  'timed_out',
  'skipped',
  'neutral',
  'action_required',
  'startup_failure',
  'stale',
]);
const triggers = new Set(['pull_request', 'push', 'merge_group', 'workflow_dispatch']);
const jobs: Record<string, string> = {
  'Lint, format, types and build': 'quality',
  'Tests (Node 22)': 'tests_node22',
  'Tests (Node 24)': 'tests_node24',
  'Electron smoke (macos-15)': 'desktop_macos',
  'Electron smoke (windows-2025)': 'desktop_windows',
  'Packaged app (ubuntu-24.04)': 'installer_linux',
  'Packaged app (macos-15)': 'installer_macos_arm64',
  'Packaged app (macos-15-intel)': 'installer_macos_x64',
  'Packaged app (windows-2025)': 'installer_windows',
  CI: 'aggregate',
};
const steps: Record<string, string> = {
  Lint: 'lint',
  'Check formatting': 'format',
  'Check types': 'types',
  'Build browser and Electron bundles': 'app_build',
  'Build public landing page': 'landing_build',
  'Build installers': 'installer_build',
  'Run unit, HTTP, adapter, MCP and browser tests': 'tests',
  'Build and verify the actual Electron renderer': 'desktop_smoke',
  'Verify Windows installer process handling': 'installer_process_smoke',
  'Verify packaged app (Linux)': 'packaged_smoke',
  'Verify packaged app (Windows and macOS)': 'packaged_smoke',
};

export type RecordData = Record<string, unknown>;
export interface EngineeringEvent {
  event:
    | 'pitchcrew_ci_run_completed'
    | 'pitchcrew_ci_job_completed'
    | 'pitchcrew_ci_step_completed'
    | 'pitchcrew_pr_merged';
  uuid: string;
  timestamp: string;
  distinct_id: 'pitchcrew_repository_ci';
  properties: Record<string, string | number | boolean>;
}

export function object(value: unknown): RecordData {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordData)
    : {};
}
function time(value: unknown): number | undefined {
  if (typeof value !== 'string') return;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
function seconds(start: unknown, end: unknown): number | undefined {
  const from = time(start);
  const to = time(end);
  return from !== undefined && to !== undefined && to >= from ? (to - from) / 1000 : undefined;
}
function conclusion(value: unknown): string {
  return typeof value === 'string' && conclusions.has(value) ? value : 'other';
}
function event(
  name: EngineeringEvent['event'],
  key: string,
  timestamp: unknown,
  properties: EngineeringEvent['properties'],
): EngineeringEvent | undefined {
  const at = time(timestamp);
  if (at === undefined) return;
  const bytes = createHash('sha256')
    .update(`pitchcrew-engineering-v1:${repository}:${key}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 15) | 64;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = bytes.toString('hex');
  return {
    event: name,
    uuid: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
    timestamp: new Date(at).toISOString(),
    distinct_id: 'pitchcrew_repository_ci',
    properties: {
      ...properties,
      repository: 'pitchcrew',
      engineering_schema: 1,
      telemetry_source: 'github_repository',
      $process_person_profile: false,
      $ip: '0.0.0.0',
    },
  };
}
function id(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function runEvents(raw: unknown, rawJobs: unknown[]): EngineeringEvent[] {
  const run = object(raw);
  if (run.name !== 'CI' || run.status !== 'completed' || !id(run.id) || !id(run.run_attempt))
    return [];
  const completed = rawJobs.map(object).filter((job) => job.status === 'completed' && id(job.id));
  const starts = completed
    .map((job) => time(job.started_at))
    .filter((value): value is number => value !== undefined);
  const finishes = completed
    .map((job) => time(job.completed_at))
    .filter((value): value is number => value !== undefined);
  const output: EngineeringEvent[] = [];
  const common = {
    workflow: 'ci',
    trigger: typeof run.event === 'string' && triggers.has(run.event) ? run.event : 'other',
    attempt: run.run_attempt,
  };
  if (starts.length && finishes.length) {
    const start = Math.min(...starts);
    const finish = Math.max(...finishes);
    if (finish >= start) {
      const item = event(
        'pitchcrew_ci_run_completed',
        `run:${run.id}:${run.run_attempt}`,
        new Date(finish).toISOString(),
        {
          ...common,
          conclusion: conclusion(run.conclusion),
          job_span_seconds: (finish - start) / 1000,
        },
      );
      if (item) output.push(item);
    }
  }
  for (const job of completed) {
    const duration = seconds(job.started_at, job.completed_at);
    const jobKind =
      typeof job.name === 'string' && Object.hasOwn(jobs, job.name) ? jobs[job.name]! : 'other';
    if (duration === undefined) continue;
    const item = event(
      'pitchcrew_ci_job_completed',
      `job:${run.id}:${run.run_attempt}:${job.id}`,
      job.completed_at,
      {
        ...common,
        job: jobKind,
        conclusion: conclusion(job.conclusion),
        duration_seconds: duration,
      },
    );
    if (item) output.push(item);
    if (!Array.isArray(job.steps)) continue;
    for (const rawStep of job.steps) {
      const step = object(rawStep);
      const stepKind =
        typeof step.name === 'string' && Object.hasOwn(steps, step.name)
          ? steps[step.name]
          : undefined;
      const stepDuration = seconds(step.started_at, step.completed_at);
      if (
        !stepKind ||
        step.status !== 'completed' ||
        !id(step.number) ||
        stepDuration === undefined
      )
        continue;
      const stepItem = event(
        'pitchcrew_ci_step_completed',
        `step:${run.id}:${run.run_attempt}:${job.id}:${step.number}`,
        step.completed_at,
        {
          ...common,
          job: jobKind,
          step: stepKind,
          conclusion: conclusion(step.conclusion),
          duration_seconds: stepDuration,
        },
      );
      if (stepItem) output.push(stepItem);
    }
  }
  return output;
}

export function mergedPullRequestEvent(raw: unknown): EngineeringEvent | undefined {
  const pr = object(raw);
  const user = object(pr.user);
  const author = typeof user.login === 'string' ? user.login : '';
  const bot =
    user.type === 'Bot' ||
    author.endsWith('[bot]') ||
    ['dependabot', 'github-actions', 'posthog-bot', 'renovate'].includes(author);
  const duration = seconds(pr.created_at, pr.merged_at);
  const base = object(pr.base);
  if (
    !id(pr.number) ||
    bot ||
    pr.draft !== false ||
    duration === undefined ||
    !['dev', 'main'].includes(String(base.ref))
  )
    return;
  return event('pitchcrew_pr_merged', `pr:${pr.number}:merged`, pr.merged_at, {
    target_branch: base.ref as string,
    open_to_merge_seconds: duration,
  });
}
