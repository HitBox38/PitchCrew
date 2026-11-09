import { expect, it } from 'vitest';
import type { Approval, Card } from '@pitchcrew/core';
import { splitJobHistory, technicalHistory, historySentence } from '../history.ts';
import { exportFormats, suggestedExportFormat } from '../export-format.ts';
import type { JobHistoryEvent } from '../hooks/useJobHistory.ts';
import { exportHandoffNext } from '@/components/InboxView/handoff.ts';
import { pendingJobAction } from '@/WorkspaceStore/job-actions.ts';

const event = (id: number, message: string, extra: Partial<JobHistoryEvent> = {}) =>
  ({
    id,
    kind: 'card',
    actor: 'writer',
    message,
    createdAt: '2026-11-08T00:00:00Z',
    ...extra,
  }) as JobHistoryEvent;

it('keeps meaningful job history first and only clearly known bookkeeping in the technical record', () => {
  const events = [
    event(9, 'Saved turn activity', { kind: 'run', runStatus: 'completed' }),
    event(8, 'Released application', { actor: 'orchestrator' }),
    event(7, 'Moved to agreed'),
    event(6, 'Running the deterministic demo workflow.', { kind: 'run', runStatus: 'running' }),
    event(5, 'Writer claimed this application', { actor: 'orchestrator' }),
    event(4, 'Packet changed during review.', { kind: 'run', runStatus: 'failed' }),
    event(3, 'Released interrupted run', { actor: 'system' }),
    event(2, 'Something new the app has never said'),
    event(1, 'Run failed while saving', { kind: 'run', runStatus: 'running' }),
  ];
  const { meaningful, technical } = splitJobHistory(events);
  expect(meaningful.map((item) => item.id)).toEqual([7, 4, 3, 2, 1]);
  expect(technical.map((item) => item.id)).toEqual([9, 8, 6, 5]);
  expect(meaningful.length + technical.length).toBe(events.length);
  expect(technicalHistory(event(10, 'Started Writer on demo', { kind: 'run' }))).toBe(false);
  expect(
    technicalHistory(
      event(11, 'Unfamiliar progress needs attention', { kind: 'run', runStatus: 'running' }),
    ),
  ).toBe(false);
  expect(
    technicalHistory(event(12, 'Released application', { kind: 'run', runStatus: 'failed' })),
  ).toBe(false);
  expect(
    technicalHistory(event(13, 'Started Writer on demo', { kind: 'run', runStatus: 'running' })),
  ).toBe(true);
  expect(
    technicalHistory(
      event(14, 'Started Writer on unknown-provider', { kind: 'run', runStatus: 'running' }),
    ),
  ).toBe(false);
  expect(historySentence(event(7, 'Moved to agreed'), () => undefined)).toBe('Moved to Reviewed');
  expect(historySentence(event(2, 'Unknown wording'), () => undefined)).toBe('Unknown wording');
  expect(technicalHistory(event(15, 'Recorded run Profile version'))).toBe(true);
  expect(
    technicalHistory(event(16, 'Scout started a chat turn', { kind: 'run', runStatus: 'running' })),
  ).toBe(true);
});

const form = (fields: { label: string; accept: string }[]) =>
  ({
    applicationContext: {
      form: {
        status: 'inspected',
        fields: fields.map((field) => ({ ...field, type: 'file', visible: true, disabled: false })),
      },
    },
  }) as unknown as Card;

it('suggests an export format from the inspected uploads, never claiming one is universal', () => {
  const unchecked = suggestedExportFormat({} as Card);
  expect(unchecked.format).toBe('pdf');
  expect(unchecked.reason).toContain('hasn’t checked');
  expect(suggestedExportFormat(form([{ label: 'Resume', accept: '.pdf,.docx' }])).format).toBe(
    'pdf',
  );
  expect(suggestedExportFormat(form([{ label: 'Resume/CV', accept: '' }])).format).toBe('pdf');
  expect(suggestedExportFormat(form([{ label: 'Resume', accept: '.doc,.docx' }]))).toMatchObject({
    format: 'docx',
    reason: expect.stringContaining('accepts Word'),
  });
  const word = suggestedExportFormat(
    form([
      { label: 'Resume', accept: '.docx' },
      { label: 'Cover letter', accept: '.pdf,.docx' },
    ]),
  );
  expect(word.format).toBe('docx');
  expect(word.reason).not.toContain('not PDF');
  expect(
    suggestedExportFormat(
      form([
        { label: 'Resume', accept: 'application/pdf' },
        { label: 'Cover letter', accept: '.docx' },
      ]),
    ).format,
  ).toBe('both');
  const text = suggestedExportFormat(form([{ label: 'Resume', accept: '.txt' }]));
  expect(text.format).toBe('markdown');
  expect(text.reason).toContain('Resume (.txt)');
  // Uploads that are not resume or cover letter fields do not decide the format.
  expect(suggestedExportFormat(form([{ label: 'Portfolio', accept: '.zip' }])).format).toBe('pdf');
  expect(exportFormats('both')).toEqual(['pdf', 'docx']);
  expect(exportFormats('markdown')).toEqual([]);
  expect(exportFormats('docx')).toEqual(['docx']);
});

it('describes export work truthfully and hands manual exports a next step without sending', () => {
  expect(pendingJobAction('/cards/job/approval', 'POST', {}, null)?.label).toBe(
    'Preparing and checking documents…',
  );
  expect(pendingJobAction('/cards/job/notes', 'POST', {}, null)?.label).toBe('Saving job…');
  const manual = { submission: { method: 'manual' } } as Approval;
  expect(exportHandoffNext(manual, true, 'Waypoint')).toContain('Nothing has been sent');
  expect(exportHandoffNext(manual, false, 'Waypoint')).toBe(
    'These are the exact files you approved.',
  );
});
