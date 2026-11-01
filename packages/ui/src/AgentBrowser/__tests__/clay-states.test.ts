import { describe, expect, it } from 'vitest';
import type { ComputerApproval, FormAssessment } from '@pitchcrew/core';
import {
  automaticSteps,
  closedPageTime,
  formFillProgress,
  recentPageRows,
  stepFieldLabel,
} from '../clay-states.ts';

const now = new Date(2026, 9, 31, 15, 0).getTime();

describe('recently closed browser pages', () => {
  it('lists the newest pages first by host and title', () => {
    const rows = recentPageRows(
      [
        { url: 'https://www.example.com/jobs/1', title: 'Old posting', visitedAt: now - 3600_000 },
        { url: 'https://apply.example.org/form', title: '', visitedAt: now - 60_000 },
        { url: 'https://example.net/a', title: 'https://example.net/a', visitedAt: now - 10 },
        { url: 'https://example.dev/', title: 'Dropped', visitedAt: now - 7200_000 },
      ],
      now,
    );
    expect(rows.map((row) => [row.host, row.title])).toEqual([
      ['example.net', ''],
      ['apply.example.org', ''],
      ['example.com', 'Old posting'],
    ]);
  });
  it('shows a time today, a weekday this week and a date before that', () => {
    expect(closedPageTime(now - 60_000, now)).toBe(
      new Date(now - 60_000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    );
    const twoDays = now - 2 * 24 * 3600_000;
    expect(closedPageTime(twoDays, now)).toBe(
      new Date(twoDays).toLocaleDateString(undefined, { weekday: 'short' }),
    );
    const older = now - 30 * 24 * 3600_000;
    expect(closedPageTime(older, now)).toBe(
      new Date(older).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    );
  });
});

describe('automatic preparation steps', () => {
  const step = (id: string, patch: Partial<ComputerApproval>) =>
    ({
      id,
      runId: 'run',
      roleId: 'writer',
      automatic: true,
      status: 'consumed',
      createdAt: `2026-10-31T10:0${id}:00.000Z`,
      action: { kind: 'fill', selector: '#name', value: 'x' },
      ...patch,
    }) as ComputerApproval;
  it('keeps only settled automatic records from this run, newest first', () => {
    const steps = automaticSteps(
      [
        step('1', {}),
        step('2', { automatic: false }),
        step('3', { runId: 'other' }),
        step('4', { status: 'pending' }),
        step('5', {}),
        step('6', { roleId: 'scout' }),
        step('7', { status: 'failed' }),
      ],
      'writer',
      'run',
    );
    expect(steps.map((item) => item.id)).toEqual(['7', '5']);
  });
  it('lists nothing without a run', () => {
    expect(automaticSteps([step('1', {})], 'writer', null)).toEqual([]);
  });
});

describe('form filling progress', () => {
  const page = 'https://boards.example.com/acme/jobs/1/apply';
  const field = (selector: string, patch: Record<string, unknown> = {}) => ({
    selector,
    label: selector.slice(1),
    type: 'text',
    required: true,
    visible: true,
    disabled: false,
    accept: '',
    options: [],
    condition: '',
    missingAnswer: '',
    assessed: true,
    ...patch,
  });
  const assessment = {
    page: { url: `${page}?step=1` },
    fields: [
      field('#first'),
      field('#email'),
      field('#resume', { type: 'file' }),
      field('#submit', { type: 'submit' }),
      field('#hidden', { visible: false }),
      field('#skipped', { assessed: false }),
    ],
  } as unknown as FormAssessment;
  const done = (
    id: string,
    action: Record<string, unknown>,
    patch: Partial<ComputerApproval> = {},
  ) =>
    ({
      id,
      runId: 'run',
      roleId: 'submitter',
      status: 'consumed',
      createdAt: '2026-10-31T10:00:00.000Z',
      page: { url: page },
      action,
      ...patch,
    }) as unknown as ComputerApproval;
  const progress = (approvals: ComputerApproval[], url = page) =>
    formFillProgress(approvals, assessment, 'submitter', 'run', url);
  it('counts distinct assessed fields this run filled on the same page', () => {
    expect(
      progress([
        done('1', { kind: 'fill', selector: '#first', value: 'Sam' }),
        done('2', { kind: 'fill', selector: '#first', value: 'Sam' }, { automatic: true }),
        done('3', { kind: 'click', selector: '#submit' }),
        done('4', { kind: 'fill', selector: '#email', value: 'x' }, { status: 'failed' }),
        done('5', { kind: 'fill', selector: '#email', value: 'x' }, { runId: 'other' }),
      ]),
    ).toEqual({ filled: 1, total: 3 });
  });
  it('shows no count off the inspected page or when a fill cannot be matched', () => {
    expect(progress([], 'https://boards.example.com/other')).toBeNull();
    expect(
      progress([done('1', { kind: 'fill', selector: 'input[name=x]', value: 'a' })]),
    ).toBeNull();
    expect(formFillProgress([], undefined, 'submitter', 'run', page)).toBeNull();
    expect(formFillProgress([], assessment, 'submitter', null, page)).toBeNull();
  });
  it('labels steps by the inspected field they filled', () => {
    expect(
      stepFieldLabel(done('1', { kind: 'fill', selector: '#email', value: 'x' }), assessment),
    ).toBe('email');
    expect(stepFieldLabel(done('1', { kind: 'navigate', url: page }), assessment)).toBeUndefined();
  });
});
