import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import type { ReportBindings } from './scheduled-reports.ts';
import manifest from '../../posthog/scheduled-reports/reports.json' with { type: 'json' };
import { planScheduledReports, publicReportPlan } from './scheduled-reports.ts';

const now = new Date('2026-10-12T00:00:00Z');
function bindings(): ReportBindings {
  return {
    projectId: 295060,
    featuresReady: true,
    user: { email: 'fixture@example.com', is_email_verified: true },
    schedule: {
      confirmed: true,
      recurrenceVerified: true,
      weekday: 'sunday',
      timeZone: 'UTC',
      startDate: '2026-10-18T09:00:00+03:00',
    },
    existingSubscriptionsComplete: true,
    existingSubscriptions: [],
    subscriptionLimit: 5,
    reports: Object.fromEntries(
      manifest.reports.map((report, index) => [
        report.key,
        {
          dashboardId: 100 + index,
          periodDays: 7,
          filterTestAccounts: true,
          coverageReviewed: true,
          tiles: [{ insightId: 200 + index, onDashboard: true, reviewed: true, status: 'ready' }],
        },
      ]),
    ),
  };
}

test('prepares five weekly dashboard snapshots without immediate messages, AI or private stdout', () => {
  const plan = planScheduledReports(manifest, bindings(), now);
  assert.equal(plan.operations.length, 5);
  for (const operation of plan.operations) {
    assert.equal(operation.payload!.send_test_now, false);
    assert.equal(operation.payload!.summary_enabled, false);
    assert.equal(operation.payload!.target_type, 'email');
    assert.equal(operation.payload!.frequency, 'weekly');
    assert.equal(operation.payload!.interval, 1);
    assert.equal('next_delivery_date' in operation.payload!, false);
    assert.equal('timeZone' in operation.payload!, false);
  }
  assert.equal(JSON.stringify(publicReportPlan(plan)).includes('fixture@example.com'), false);
});

test('reuses equivalent existing schedules even with an older recurrence anchor', () => {
  const input = bindings();
  const payload = planScheduledReports(manifest, input, now).operations[0].payload!;
  input.existingSubscriptions = [
    {
      ...payload,
      id: 999,
      resource_type: 'dashboard',
      start_date: '2026-10-11T09:00:00+03:00',
      target_value: 'FIXTURE@example.com',
    },
  ];
  const plan = planScheduledReports(manifest, input, now);
  assert.deepEqual(plan.operations[0], { key: 'product', action: 'reuse', subscriptionId: 999 });
});

test('requires complete duplicate reads, verified recipient and confirmed schedule', () => {
  for (const mutate of [
    (input: ReportBindings) => {
      input.existingSubscriptionsComplete = false;
    },
    (input: ReportBindings) => {
      input.user.is_email_verified = false;
    },
    (input: ReportBindings) => {
      input.schedule.confirmed = false;
    },
    (input: ReportBindings) => {
      input.schedule.recurrenceVerified = false;
    },
    (input: ReportBindings) => {
      input.featuresReady = false;
    },
    (input: ReportBindings) => {
      input.subscriptionLimit = undefined;
    },
  ]) {
    const input = bindings();
    mutate(input);
    assert.throws(() => planScheduledReports(manifest, input, now));
  }
});

test('rejects conflicts and duplicate saved resources without updating or resuming them', () => {
  const input = bindings();
  const payload = planScheduledReports(manifest, input, now).operations[0].payload!;
  input.existingSubscriptions = [
    { ...payload, id: 999, resource_type: 'dashboard', enabled: false },
  ];
  assert.throws(() => planScheduledReports(manifest, input, now), /conflicts/);
  input.existingSubscriptions = [1, 2].map((id) => ({
    ...payload,
    id,
    resource_type: 'dashboard',
  }));
  assert.throws(() => planScheduledReports(manifest, input, now), /Multiple equivalent/);
});

test('enforces quota including paused subscriptions, excludes deleted subscriptions', () => {
  const input = bindings();
  input.existingSubscriptions = [{ id: 900, enabled: false, deleted: false }];
  assert.throws(() => planScheduledReports(manifest, input, now), /quota/);
  input.existingSubscriptions[0].deleted = true;
  assert.equal(planScheduledReports(manifest, input, now).operations.length, 5);
});

test('does not send unsupported metrics and labels empty instrumented charts', () => {
  const input = bindings();
  input.reports.diagnostics.tiles = [{ insightId: 222, status: 'not-collected' }];
  input.reports['ai-mcp'].tiles[0].status = 'no-data';
  assert.throws(() => planScheduledReports(manifest, input, now), /Label empty/);
  input.reports['ai-mcp'].tiles[0].emptyLabel = 'No captured data';
  const plan = planScheduledReports(manifest, input, now);
  assert.equal(plan.operations[2].action, 'pending');
  assert.equal(plan.operations[3].action, 'create');
});

test('requires reviewed filters, tile membership, unique IDs and at most ten selections', () => {
  for (const mutate of [
    (input: ReportBindings) => {
      input.reports.product.periodDays = 30;
    },
    (input: ReportBindings) => {
      input.reports.product.filterTestAccounts = false;
    },
    (input: ReportBindings) => {
      input.reports.product.coverageReviewed = false;
    },
    (input: ReportBindings) => {
      input.reports.product.tiles[0].onDashboard = false;
    },
    (input: ReportBindings) => {
      input.reports.product.tiles[0].deleted = true;
    },
    (input: ReportBindings) => {
      input.reports.product.tiles.push(input.reports.product.tiles[0]);
    },
    (input: ReportBindings) => {
      input.reports.product.tiles = Array.from({ length: 11 }, (_, index) => ({
        insightId: index + 1,
        onDashboard: true,
        reviewed: true,
        status: 'ready',
      }));
    },
  ]) {
    const input = bindings();
    mutate(input);
    assert.throws(() => planScheduledReports(manifest, input, now));
  }
});

test('engineering repository filtering is a reviewed exception, never an app-user cohort claim', () => {
  const input = bindings();
  input.reports.engineering.filterTestAccounts = false;
  input.reports.engineering.population = 'public-repository';
  assert.throws(() => planScheduledReports(manifest, input, now), /Review period/);
  input.reports.engineering.repositoryFiltersReviewed = true;
  assert.equal(planScheduledReports(manifest, input, now).operations[4].action, 'create');
  Object.assign(input.reports.product, {
    filterTestAccounts: false,
    population: 'public-repository',
    repositoryFiltersReviewed: true,
  });
  assert.throws(() => planScheduledReports(manifest, input, now), /Review period/);
});

test('validates explicit timezone, weekday, half-hour schedule and future anchor', () => {
  for (const schedule of [
    { startDate: '2026-10-18T09:15:00+03:00' },
    { startDate: '2026-10-18T09:00:00' },
    { startDate: '2026-10-12T00:15:00Z' },
    { weekday: 'tuesday' },
    { timeZone: 'Unknown/Nowhere' },
  ]) {
    const input = bindings();
    Object.assign(input.schedule, schedule);
    assert.throws(() => planScheduledReports(manifest, input, now));
  }
  const input = bindings();
  Object.assign(input.schedule, { startDate: '2026-11-01T08:00:00+02:00' });
  assert.equal(planScheduledReports(manifest, input, now).scheduleTimeZone, 'UTC');
});

test('CLI writes private payload exclusively and never prints recipient, including on failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-report-test-'));
  try {
    const inputPath = join(directory, 'bindings.json');
    const outputPath = join(directory, 'plan.json');
    const input = bindings();
    input.schedule.startDate = '2099-01-04T06:00:00Z';
    // Choose the confirmed weekday without depending on the machine clock.
    let date = new Date(input.schedule.startDate);
    while (
      new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(date) !==
      'Sunday'
    )
      date = new Date(date.getTime() + 86400_000);
    input.schedule.startDate = date.toISOString().replace('.000Z', 'Z');
    await writeFile(inputPath, JSON.stringify(input), { mode: 0o600 });
    const command = new URL('./scheduled-reports.ts', import.meta.url);
    const run = () =>
      spawnSync(process.execPath, [command.pathname, inputPath, outputPath], { encoding: 'utf8' });
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.includes(input.user.email), false);
    const file = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.equal(file.operations[0].payload.target_value, input.user.email);
    if (process.platform !== 'win32') assert.equal((await stat(outputPath)).mode & 0o777, 0o600);
    const original = await readFile(outputPath, 'utf8');
    const retry = run();
    assert.equal(retry.status, 1);
    assert.equal(retry.stderr.includes(input.user.email), false);
    assert.equal(await readFile(outputPath, 'utf8'), original);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
