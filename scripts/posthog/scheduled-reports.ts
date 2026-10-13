import type manifestDefinition from '../../posthog/scheduled-reports/reports.json';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export type ReportManifest = typeof manifestDefinition;
interface ReportTile {
  insightId: number;
  status: string;
  onDashboard?: boolean;
  reviewed?: boolean;
  deleted?: boolean;
  emptyLabel?: string;
}
interface ReportBinding {
  dashboardId: number;
  periodDays: number;
  filterTestAccounts: boolean;
  coverageReviewed: boolean;
  population?: string;
  repositoryFiltersReviewed?: boolean;
  tiles: ReportTile[];
}
export interface SubscriptionPayload {
  dashboard: number;
  dashboard_export_insights: number[];
  target_type: string;
  target_value: string;
  frequency: string;
  interval: number;
  byweekday: string[];
  start_date: string;
  enabled: boolean;
  title: string;
  send_test_now: boolean;
  summary_enabled: boolean;
}
export interface SavedSubscription extends Partial<SubscriptionPayload> {
  id: number;
  resource_type?: string;
  deleted?: boolean;
  until_date?: string | null;
  count?: number | null;
}
export interface ReportBindings {
  projectId: number;
  featuresReady: boolean;
  user: { email: string; is_email_verified: boolean };
  schedule: {
    confirmed: boolean;
    recurrenceVerified: boolean;
    weekday: string;
    timeZone: string;
    startDate: string;
  };
  existingSubscriptionsComplete: boolean;
  existingSubscriptions: SavedSubscription[];
  subscriptionLimit?: number | null;
  reports: Record<string, ReportBinding>;
}
interface ReportOperation {
  key: string;
  action: string;
  payload?: SubscriptionPayload;
  subscriptionId?: number;
  reason?: string;
  coverageNote?: string;
}

const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
function fail(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const positiveId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const sameSet = (left: unknown, right: unknown) =>
  Array.isArray(left) &&
  Array.isArray(right) &&
  JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());

function sameDestination(left: unknown, right: string) {
  return typeof left === 'string' && left.trim().toLowerCase() === right.toLowerCase();
}

function sameSubscription(
  saved: SavedSubscription,
  payload: SubscriptionPayload,
  timeZone: string,
) {
  const clock = (date: string) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(date));
  return (
    saved.resource_type === 'dashboard' &&
    saved.dashboard === payload.dashboard &&
    saved.target_type === 'email' &&
    sameDestination(saved.target_value, payload.target_value) &&
    sameSet(saved.dashboard_export_insights, payload.dashboard_export_insights) &&
    saved.frequency === payload.frequency &&
    saved.interval === payload.interval &&
    sameSet(saved.byweekday, payload.byweekday) &&
    Number.isFinite(new Date(saved.start_date ?? '').getTime()) &&
    clock(saved.start_date ?? '') === clock(payload.start_date) &&
    saved.enabled === true &&
    saved.summary_enabled !== true &&
    saved.until_date == null &&
    saved.count == null
  );
}

/** Prepare only. This module has no network or delivery capability. */
export function planScheduledReports(
  manifest: ReportManifest,
  bindings: ReportBindings,
  now = new Date(),
) {
  fail(
    manifest.schemaVersion === 1 && manifest.projectId === 295060,
    'Unsupported report manifest/project',
  );
  fail(manifest.host === 'https://eu.posthog.com', 'Unsupported PostHog host');
  fail(
    manifest.frequency === 'weekly' && manifest.interval === 1,
    'Only weekly reports are supported',
  );
  fail(
    manifest.sendTestNow === false && manifest.summaryEnabled === false,
    'Immediate delivery and AI summaries must stay disabled',
  );
  fail(
    manifest.reportPeriodDays === 7 && manifest.filterTestAccounts === true,
    'Require seven-day reports with internal/test filtering',
  );
  fail(
    bindings.projectId === manifest.projectId && bindings.featuresReady === true,
    'Finish integration before preparing subscriptions',
  );
  fail(
    bindings.user?.is_email_verified === true && /^\S+@\S+\.\S+$/.test(bindings.user.email),
    'Require the verified authenticated account email',
  );
  fail(
    bindings.existingSubscriptionsComplete === true &&
      Array.isArray(bindings.existingSubscriptions),
    'Read every subscription page before duplicate detection',
  );
  fail(
    bindings.schedule?.confirmed === true,
    'Confirm report weekday, time and timezone before preparing subscriptions',
  );
  fail(
    bindings.schedule.recurrenceVerified === true,
    'Verify server recurrence preserves the requested timezone across daylight saving before planning activation',
  );
  const { startDate, timeZone, weekday } = bindings.schedule;
  fail(
    manifest.schedule?.confirmed === true &&
      timeZone === manifest.schedule.timeZone &&
      weekday === manifest.schedule.weekday,
    'Schedule must match the user-confirmed report manifest',
  );
  fail(
    typeof startDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:Z|[+-]\d{2}:\d{2})$/.test(startDate),
    'Require an explicit offset timestamp at whole minutes',
  );
  const start = new Date(startDate);
  fail(
    Number.isFinite(start.getTime()) && start.getTime() > now.getTime() + 16 * 60_000,
    'First delivery must be more than 16 minutes in the future',
  );
  fail(weekdays.includes(weekday), 'Unsupported weekday');
  fail(typeof timeZone === 'string' && timeZone.length > 0, 'Require an explicit IANA timezone');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(start);
  const localTime = `${parts.find((part) => part.type === 'hour')?.value}:${parts.find((part) => part.type === 'minute')?.value}`;
  fail(
    localTime === manifest.schedule.localTime,
    'Start date must match the user-confirmed local time',
  );
  fail(
    parts.find((part) => part.type === 'weekday')?.value.toLowerCase() === weekday,
    'Start date must match the confirmed local weekday',
  );
  fail(
    ['00', '30'].includes(parts.find((part) => part.type === 'minute')?.value ?? ''),
    'PostHog delivery runs at :00 and :30',
  );
  const reportKeys = manifest.reports.map((report) => report.key);
  fail(
    reportKeys.length > 0 && new Set(reportKeys).size === reportKeys.length,
    'Duplicate or empty report keys',
  );
  const active = bindings.existingSubscriptions.filter(
    (subscription) => subscription.deleted !== true,
  );
  const plan: ReportOperation[] = manifest.reports.map((report) => {
    fail(typeof report.title === 'string' && report.title.length > 0, 'Each report needs a title');
    const binding = bindings.reports?.[report.key];
    fail(binding && positiveId(binding.dashboardId), `Resolve dashboard for ${report.key}`);
    const reviewedRepositoryPopulation =
      report.key === 'engineering' &&
      binding.population === 'public-repository' &&
      binding.repositoryFiltersReviewed === true;
    fail(
      binding.periodDays === 7 &&
        (binding.filterTestAccounts === true || reviewedRepositoryPopulation) &&
        binding.coverageReviewed === true,
      `Review period, filters and coverage for ${report.key}`,
    );
    fail(Array.isArray(binding.tiles), `Read dashboard tiles for ${report.key}`);
    const tiles = binding.tiles.filter((tile) => tile.status !== 'not-collected');
    fail(
      binding.tiles.every((tile) => ['ready', 'no-data', 'not-collected'].includes(tile.status)),
      `Unknown coverage status in ${report.key}`,
    );
    fail(
      tiles.length <= 10 && tiles.every((tile) => positiveId(tile.insightId)),
      `Select at most ten resolved insights for ${report.key}`,
    );
    fail(
      new Set(tiles.map((tile) => tile.insightId)).size === tiles.length,
      `Duplicate insight selection for ${report.key}`,
    );
    fail(
      tiles.every(
        (tile) => tile.onDashboard === true && tile.deleted !== true && tile.reviewed === true,
      ),
      `Verify selected dashboard tiles for ${report.key}`,
    );
    fail(
      tiles.every((tile) => tile.status !== 'no-data' || tile.emptyLabel === 'No captured data'),
      `Label empty instrumented data for ${report.key}`,
    );
    if (tiles.length === 0)
      return {
        key: report.key,
        action: 'pending',
        reason: 'No instrumented report tiles',
        coverageNote: report.coverageNote,
      };
    const payload = {
      dashboard: binding.dashboardId,
      dashboard_export_insights: tiles.map((tile) => tile.insightId),
      target_type: 'email',
      target_value: bindings.user.email,
      frequency: 'weekly',
      interval: 1,
      byweekday: [weekday],
      start_date: startDate,
      enabled: true,
      title: report.title,
      send_test_now: false,
      summary_enabled: false,
    };
    const matching = active.filter((saved) => sameSubscription(saved, payload, timeZone));
    fail(
      matching.length <= 1,
      `Multiple equivalent subscriptions for ${report.key}; reconcile manually`,
    );
    if (matching.length === 1)
      return { key: report.key, action: 'reuse', subscriptionId: matching[0].id };
    const conflicting = active.filter(
      (saved) =>
        saved.title === report.title ||
        (saved.dashboard === payload.dashboard &&
          saved.target_type === 'email' &&
          sameDestination(saved.target_value, payload.target_value)),
    );
    fail(
      conflicting.length === 0,
      `Existing subscription conflicts with ${report.key}; review without sending an update`,
    );
    return { key: report.key, action: 'create', payload, coverageNote: report.coverageNote };
  });
  const creates = plan.filter((item) => item.action === 'create').length;
  fail(
    bindings.subscriptionLimit === null ||
      (typeof bindings.subscriptionLimit === 'number' &&
        Number.isSafeInteger(bindings.subscriptionLimit) &&
        bindings.subscriptionLimit >= 0),
    'Resolve subscription plan limit (null means verified unlimited)',
  );
  fail(
    bindings.subscriptionLimit === null || active.length + creates <= bindings.subscriptionLimit,
    'Subscription quota is insufficient; consolidate reports or resolve plan quota',
  );
  return {
    projectId: manifest.projectId,
    host: manifest.host,
    scheduleTimeZone: timeZone,
    operations: plan,
  };
}

export function publicReportPlan(plan: ReturnType<typeof planScheduledReports>) {
  return {
    ...plan,
    operations: plan.operations.map(({ payload, ...operation }) => ({
      ...operation,
      ...(payload
        ? {
            dashboardId: payload.dashboard,
            insightIds: payload.dashboard_export_insights,
            recipient: 'authenticated PostHog account',
            startDate: payload.start_date,
            immediateDelivery: false,
          }
        : {}),
    })),
  };
}

async function main() {
  const [bindingsPath, outputPath] = process.argv.slice(2);
  fail(
    bindingsPath,
    'Usage: node scripts/posthog/scheduled-reports.ts <private-bindings.json> [private-plan.json]',
  );
  const manifest = JSON.parse(
    await readFile(
      new URL('../../posthog/scheduled-reports/reports.json', import.meta.url),
      'utf8',
    ),
  );
  const bindings = JSON.parse(await readFile(bindingsPath, 'utf8'));
  const plan = planScheduledReports(manifest, bindings);
  if (outputPath)
    await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify(publicReportPlan(plan), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error(
      'Report planning failed. Check verified bindings, coverage, schedule, duplicates and quota; private inputs were not printed.',
    );
    process.exitCode = 1;
  });
}
