import type { JobScanSummary, JobSource } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { emptyDraft } from '../constants.ts';
import {
  boardFromLink,
  draftInput,
  filterSummary,
  keywordList,
  scanSummaryText,
  sourceDraft,
} from '../helpers.ts';

const source: JobSource = {
  id: '00000000-0000-4000-8000-000000000001',
  provider: 'ashby',
  slug: 'fabrikam',
  name: 'Fabrikam',
  enabled: true,
  filters: { titleInclude: ['designer'], titleExclude: [], locationInclude: [], remoteOnly: true },
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

describe('job source helpers', () => {
  it('splits keywords and round-trips drafts', () => {
    expect(keywordList(' engineer, ,Engineer\ndesigner,engineer ')).toEqual([
      'engineer',
      'Engineer',
      'designer',
    ]);
    expect(draftInput(sourceDraft(source))).toEqual({
      provider: 'ashby',
      slug: 'fabrikam',
      name: 'Fabrikam',
      enabled: true,
      filters: source.filters,
    });
    expect(draftInput({ ...emptyDraft, slug: ' acme ', name: ' Acme ' })).toMatchObject({
      slug: 'acme',
      name: 'Acme',
    });
  });

  it('reads board names from pasted public board links only', () => {
    expect(boardFromLink('https://job-boards.greenhouse.io/northwindlabs')).toEqual({
      provider: 'greenhouse',
      slug: 'northwindlabs',
    });
    expect(boardFromLink('boards.greenhouse.io/northwindlabs/jobs/123')).toEqual({
      provider: 'greenhouse',
      slug: 'northwindlabs',
    });
    expect(boardFromLink('https://jobs.ashbyhq.com/fabrikam?utm_source=x')).toEqual({
      provider: 'ashby',
      slug: 'fabrikam',
    });
    expect(boardFromLink('jobs.lever.co/contoso-robotics/abc')).toEqual({
      provider: 'lever',
      slug: 'contoso-robotics',
    });
    expect(boardFromLink('northwindlabs')).toEqual({ slug: 'northwindlabs' });
    expect(boardFromLink('https://evil.example/acme')).toEqual({
      slug: 'https://evil.example/acme',
    });
  });

  it('summarizes filters and scans in plain words', () => {
    expect(filterSummary(source)).toBe('titles with designer · remote only');
    const summary: JobScanSummary = {
      scannedAt: '2026-10-01T00:00:00.000Z',
      new: 1,
      duplicate: 4,
      filtered: 2,
      deferred: 0,
      failedSources: 1,
      sources: [],
      newLeads: [],
    };
    expect(scanSummaryText(summary)).toBe(
      '1 new lead, 4 already on the board, 2 filtered out. 1 source failed.',
    );
  });
});
