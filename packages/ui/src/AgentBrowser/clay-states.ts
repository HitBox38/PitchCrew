import type { ComputerApproval, FormAssessment } from '@pitchcrew/core';
import type { BrowserHistoryEntry } from './history.ts';

export interface RecentPageRow {
  url: string;
  host: string;
  title: string;
  when: string;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Today shows the time, the last week the weekday, anything older the date. */
export const closedPageTime = (visitedAt: number, now = Date.now()) => {
  const date = new Date(visitedAt);
  const today = new Date(now);
  if (sameDay(date, today))
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (now - visitedAt < 6 * 24 * 60 * 60 * 1000)
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/** Recently closed pages for the empty browser, newest first, as host plus page title. */
export const recentPageRows = (
  entries: readonly BrowserHistoryEntry[],
  now = Date.now(),
  limit = 3,
): RecentPageRow[] =>
  [...entries]
    .sort((a, b) => b.visitedAt - a.visitedAt)
    .slice(0, limit)
    .map((entry) => {
      let host = entry.url;
      try {
        host = new URL(entry.url).hostname.replace(/^www\./, '');
      } catch {
        /* history.ts only keeps valid web addresses; keep the raw text otherwise. */
      }
      return {
        url: entry.url,
        host,
        title: entry.title.trim() && entry.title !== entry.url ? entry.title.trim() : '',
        when: closedPageTime(entry.visitedAt, now),
      };
    });

/**
 * Steps the server let this run take on its own (granted sites, recognised forms), newest first.
 * Only saved exact-action records are listed; no progress totals are inferred.
 */
export const automaticSteps = (
  approvals: readonly ComputerApproval[],
  roleId: string | undefined,
  runId: string | null | undefined,
  limit = 2,
) =>
  approvals
    .filter(
      (approval) =>
        approval.automatic &&
        !!runId &&
        approval.roleId === roleId &&
        approval.runId === runId &&
        approval.status !== 'pending',
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);

const pagePath = (url: string | undefined) => {
  try {
    const parsed = new URL(url ?? '');
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url ?? '';
  }
};
const fieldKey = (selector: string, frame?: string) => `${frame ?? ''}\u0000${selector}`;
const notFields = new Set(['submit', 'button', 'reset', 'hidden', 'image']);
const filling = new Set(['fill', 'select', 'upload']);

/** Inspected form fields the agent assessed on this exact page, keyed by frame and selector. */
const formFields = (assessment: FormAssessment | undefined, pageUrl: string | undefined) => {
  if (!assessment || !pageUrl || pagePath(assessment.page.url) !== pagePath(pageUrl))
    return new Map<string, string>();
  return new Map(
    assessment.fields
      .filter((field) => field.assessed && field.visible && !field.disabled)
      .filter((field) => !notFields.has(field.type))
      .map((field) => [fieldKey(field.selector, field.frame), field.label || 'Unlabelled field']),
  );
};

/** The inspected field label an action targeted, when it matches one exactly. */
export const stepFieldLabel = (approval: ComputerApproval, assessment?: FormAssessment) =>
  'selector' in approval.action
    ? formFields(assessment, approval.page?.url).get(
        fieldKey(approval.action.selector, approval.action.frame),
      )
    : undefined;

/**
 * "N of M fields" for the form on the current page: M counts the fields the agent assessed on that
 * exact page, N the distinct ones this run filled successfully (automatic or approved). Any fill
 * that cannot be matched to an assessed field makes the count unknowable, so none is shown.
 */
export const formFillProgress = (
  approvals: readonly ComputerApproval[],
  assessment: FormAssessment | undefined,
  roleId: string | undefined,
  runId: string | null | undefined,
  pageUrl: string | undefined,
) => {
  const fields = formFields(assessment, pageUrl);
  if (!runId || !fields.size) return null;
  const filled = new Set<string>();
  for (const approval of approvals) {
    if (approval.roleId !== roleId || approval.runId !== runId || approval.status !== 'consumed')
      continue;
    if (!('selector' in approval.action) || pagePath(approval.page?.url) !== pagePath(pageUrl))
      continue;
    const key = fieldKey(approval.action.selector, approval.action.frame);
    if (fields.has(key)) {
      if (filling.has(approval.action.kind) || approval.action.kind === 'click') filled.add(key);
    } else if (filling.has(approval.action.kind)) return null;
  }
  return { filled: filled.size, total: fields.size };
};
