import type { JobScanSummary, JobSource } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { emptyDraft } from '../constants.ts';
import {
  boardFromLink,
  canTest,
  draftInput,
  filterSummary,
  keywordList,
  scanSummaryText,
  sourceDraft,
  tokenFromInput,
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

  it('reads Ashby board names with dots and encoded spaces', () => {
    expect(boardFromLink('https://jobs.ashbyhq.com/Northwind%20Labs')).toEqual({
      provider: 'ashby',
      slug: 'Northwind Labs',
    });
    expect(
      boardFromLink('https://jobs.ashbyhq.com/example.io/0a1b2c3d-0002-4a5b-8c9d-000000000002'),
    ).toEqual({ provider: 'ashby', slug: 'example.io' });
    expect(boardFromLink('jobs.ashbyhq.com/contoso.ai?utm_source=x')).toEqual({
      provider: 'ashby',
      slug: 'contoso.ai',
    });
    expect(boardFromLink('Northwind Labs')).toEqual({ slug: 'Northwind Labs' });
    expect(boardFromLink('example.io')).toEqual({ slug: 'example.io' });
    // Only %20 is decoded; other escapes stay visible so validation rejects them.
    expect(boardFromLink('https://jobs.ashbyhq.com/acme%2Fjobs')).toEqual({
      provider: 'ashby',
      slug: 'acme%2Fjobs',
    });
    expect(boardFromLink('https://jobs.ashbyhq.com/acme%252E')).toEqual({
      provider: 'ashby',
      slug: 'acme%252E',
    });
  });

  it('reads Workable accounts from careers, legacy and API links', () => {
    expect(boardFromLink('https://apply.workable.com/litware/')).toEqual({
      provider: 'workable',
      slug: 'litware',
    });
    expect(boardFromLink('apply.workable.com/litware/j/3F2A1B0C9D/')).toEqual({
      provider: 'workable',
      slug: 'litware',
    });
    expect(
      boardFromLink('https://apply.workable.com/api/v1/widget/accounts/litware?details=true'),
    ).toEqual({ provider: 'workable', slug: 'litware' });
    expect(boardFromLink('https://litware.workable.com/')).toEqual({
      provider: 'workable',
      slug: 'litware',
    });
    // A shortlink names no account, so the pasted text stays for the user to fix.
    expect(boardFromLink('https://apply.workable.com/j/3F2A1B0C9D')).toEqual({
      provider: 'workable',
      slug: 'https://apply.workable.com/j/3F2A1B0C9D',
    });
  });

  it('reads the Comeet company UID from links and the token only from API links', () => {
    expect(boardFromLink('https://www.comeet.com/jobs/wingtip-analytics/A1.B2C')).toEqual({
      provider: 'comeet',
      slug: 'A1.B2C',
    });
    expect(
      boardFromLink('comeet.com/jobs/wingtip-analytics/A1.B2C/senior-backend-engineer/A1.00D'),
    ).toEqual({ provider: 'comeet', slug: 'A1.B2C' });
    expect(boardFromLink('A1.B2C')).toEqual({ slug: 'A1.B2C' });
    expect(boardFromLink('https://www.comeet.com/jobs/A1.B2C/C3.D4E')).toEqual({
      provider: 'comeet',
      slug: 'A1.B2C',
    });
    const api =
      'https://www.comeet.co/careers-api/2.0/company/A1.B2C/positions?token=FictionalToken0123456789&details=true';
    expect(boardFromLink(api)).toEqual({
      provider: 'comeet',
      slug: 'A1.B2C',
      token: 'FictionalToken0123456789',
    });
    expect(tokenFromInput(api)).toEqual({
      provider: 'comeet',
      slug: 'A1.B2C',
      token: 'FictionalToken0123456789',
    });
    expect(tokenFromInput(' FictionalToken0123456789 ')).toEqual({
      token: 'FictionalToken0123456789',
    });
    expect(boardFromLink('https://comeet.example/jobs/x/A1.B2C')).toEqual({
      slug: 'https://comeet.example/jobs/x/A1.B2C',
    });
  });

  it.each([
    'https://www.comeet.co/jobs/A1.B2C/C3.D4E/apply?token=FICTIONAL0123456789ABCDEF0123456789&embedded=true',
    'https://www.comeet.co/jobs/A1.B2C/C3.D4E/apply?token=FICTIONAL0123456789ABCDEF0123456789',
    'https://www.comeet.co/jobs/A1.B2C/C3.D4E?token=FICTIONAL0123456789ABCDEF0123456789&embedded=true',
    'www.comeet.com/jobs/A1.B2C/C3.D4E?embedded=true&token=FICTIONAL0123456789ABCDEF0123456789',
  ])('reads the company UID and token from the Comeet embed link %s', (link) => {
    const expected = {
      provider: 'comeet',
      slug: 'A1.B2C',
      token: 'FICTIONAL0123456789ABCDEF0123456789',
    };
    expect(boardFromLink(link)).toEqual(expected);
    expect(tokenFromInput(link)).toEqual(expected);
  });

  it('keeps the company UID from hosted pages and ignores malformed tokens', () => {
    expect(
      boardFromLink(
        'https://www.comeet.com/jobs/wingtip-analytics/A1.B2C/backend-engineer/C3.D4E?token=FICTIONAL0123456789ABCDEF0123456789',
      ),
    ).toEqual({
      provider: 'comeet',
      slug: 'A1.B2C',
      token: 'FICTIONAL0123456789ABCDEF0123456789',
    });
    expect(
      boardFromLink('https://www.comeet.co/jobs/A1.B2C/C3.D4E/apply?token=bad%20token'),
    ).toEqual({ provider: 'comeet', slug: 'A1.B2C' });
  });

  it('sends the token only for Comeet and requires it before testing', () => {
    const comeet = {
      ...emptyDraft,
      provider: 'comeet' as const,
      slug: ' A1.B2C ',
      token: ' FictionalToken0123456789 ',
      name: 'Wingtip Analytics',
    };
    expect(draftInput(comeet)).toMatchObject({
      provider: 'comeet',
      slug: 'A1.B2C',
      token: 'FictionalToken0123456789',
    });
    expect(draftInput({ ...comeet, provider: 'workable' })).not.toHaveProperty('token');
    expect(canTest(comeet)).toBe(true);
    expect(canTest({ ...comeet, token: ' ' })).toBe(false);
    expect(canTest({ ...comeet, provider: 'workable', token: '' })).toBe(true);
    expect(
      sourceDraft({ ...source, provider: 'comeet', token: 'FictionalToken0123456789' }),
    ).toMatchObject({
      token: 'FictionalToken0123456789',
    });
    expect(sourceDraft(source).token).toBe('');
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
