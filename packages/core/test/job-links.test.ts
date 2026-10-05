import { describe, expect, it } from 'vitest';
import { jobLinkProvenance, recognizeJobLink, type JobLink } from '../src/index.ts';

const ashbyId = '6f1c2b3a-1111-4c3d-9e8f-0a1b2c3d4e5f';
const leverId = 'a1b2c3d4-0001-4a5b-8c9d-0e1f2a3b4c5d';
const link = (value: string): JobLink | null => {
  const result = recognizeJobLink(value);
  return result.recognized ? result.link : null;
};
const reason = (value: string): string => {
  const result = recognizeJobLink(value);
  if (result.recognized) throw new Error(`Recognized ${value}`);
  return result.reason;
};

describe('job link recognition', () => {
  it.each([
    'https://boards.greenhouse.io/northwindlabs/jobs/4010001001',
    'https://job-boards.greenhouse.io/northwindlabs/jobs/4010001001',
    'https://job-boards.greenhouse.io/northwindlabs/jobs/4010001001/',
    'https://job-boards.greenhouse.io/northwindlabs/jobs/4010001001?gh_src=abc&utm_source=x#apply',
    'https://boards.greenhouse.io/northwindlabs/jobs/4010001001?gh_jid=4010001001',
    'https://boards.greenhouse.io/embed/job_app?for=northwindlabs&token=4010001001',
    'https://boards.greenhouse.io/northwindlabs?gh_jid=4010001001',
    'HTTPS://Job-Boards.Greenhouse.io/northwindlabs/jobs/4010001001',
    '  https://boards.greenhouse.io/northwindlabs/jobs/4010001001  ',
    'https://careers.example.com/jobs?gh_jid=4010001001&for=northwindlabs',
  ])('reads a Greenhouse posting from %s', (value) => {
    expect(link(value)).toEqual({
      provider: 'greenhouse',
      board: 'northwindlabs',
      jobId: '4010001001',
      url: 'https://job-boards.greenhouse.io/northwindlabs/jobs/4010001001',
    });
  });

  it.each([
    `https://jobs.ashbyhq.com/fabrikam/${ashbyId}`,
    `https://jobs.ashbyhq.com/fabrikam/${ashbyId}/`,
    `https://jobs.ashbyhq.com/fabrikam/${ashbyId}/application`,
    `https://jobs.ashbyhq.com/fabrikam/${ashbyId}/application?utm_source=board`,
    `https://jobs.ashbyhq.com/fabrikam/${ashbyId.toUpperCase()}`,
  ])('reads an Ashby posting from %s', (value) => {
    expect(link(value)).toEqual({
      provider: 'ashby',
      board: 'fabrikam',
      jobId: ashbyId,
      url: `https://jobs.ashbyhq.com/fabrikam/${ashbyId}`,
    });
  });

  it.each([
    `https://jobs.lever.co/contoso-robotics/${leverId}`,
    `https://jobs.lever.co/contoso-robotics/${leverId}/apply`,
    `https://jobs.lever.co/contoso-robotics/${leverId}?lever-origin=applied&lever-source[]=Board`,
  ])('reads a Lever posting from %s', (value) => {
    expect(link(value)).toEqual({
      provider: 'lever',
      board: 'contoso-robotics',
      jobId: leverId,
      url: `https://jobs.lever.co/contoso-robotics/${leverId}`,
    });
  });

  it.each([
    // Other hosts, look-alikes and unsupported regions.
    'https://evil.example/northwindlabs/jobs/4010001001',
    'https://boards.greenhouse.io.evil.example/northwindlabs/jobs/4010001001',
    'https://evil.example/jobs.lever.co/contoso-robotics/' + leverId,
    'https://job-boards.eu.greenhouse.io/northwindlabs/jobs/4010001001',
    `https://jobs.eu.lever.co/contoso-robotics/${leverId}`,
    'https://boards-api.greenhouse.io/v1/boards/northwindlabs/jobs/4010001001',
    // Not https, user info, ports and odd characters.
    'http://boards.greenhouse.io/northwindlabs/jobs/4010001001',
    'boards.greenhouse.io/northwindlabs/jobs/4010001001',
    'javascript:alert(1)',
    'ftp://jobs.lever.co/contoso-robotics/' + leverId,
    'https://user:pass@jobs.lever.co/contoso-robotics/' + leverId,
    'https://user@jobs.lever.co/contoso-robotics/' + leverId,
    'https://jobs.lever.co:8443/contoso-robotics/' + leverId,
    'https://jobs.lever.co:443/contoso-robotics/' + leverId,
    'https://jobs.lever.co/contoso robotics/' + leverId,
    'https://jobs.lever.co/contoso-\nrobotics/' + leverId,
    'https://jobs.lever.co/contoso-robotics/\t' + leverId,
    // Path traversal and encoded separators.
    'https://jobs.lever.co/evil/../contoso-robotics/' + leverId,
    'https://jobs.lever.co/contoso-robotics/./' + leverId,
    'https://jobs.lever.co/%2e%2e/contoso-robotics/' + leverId,
    'https://jobs.lever.co/contoso-robotics%2F..%2Fadmin/' + leverId,
    'https://jobs.lever.co/contoso-robotics\\' + leverId,
    'https://boards.greenhouse.io//northwindlabs/jobs/4010001001',
    // Bad board names and IDs.
    'https://boards.greenhouse.io/northwindlabs/jobs/40100x1001',
    'https://boards.greenhouse.io/northwindlabs/jobs/' + '1'.repeat(21),
    'https://boards.greenhouse.io/north.wind/jobs/4010001001',
    'https://boards.greenhouse.io/-northwind/jobs/4010001001',
    'https://boards.greenhouse.io/embed/jobs/4010001001',
    'https://boards.greenhouse.io/embed/job_app?for=../admin&token=4010001001',
    'https://boards.greenhouse.io/embed/job_app?token=4010001001',
    'https://boards.greenhouse.io/embed/job_app?for=northwindlabs&token=4010001001&gh_jid=4010001002',
    'https://boards.greenhouse.io/embed/job_app?for=northwindlabs&for=another&token=4010001001',
    'https://boards.greenhouse.io/embed/job_app?for=northwindlabs&token=4010001001&token=4010001002',
    'https://boards.greenhouse.io/northwindlabs?gh_jid=4010001001&gh_jid=4010001002',
    'https://boards.greenhouse.io/northwindlabs/jobs/4010001001?gh_jid=4010001002',
    'https://jobs.ashbyhq.com/fabrikam/not-a-uuid',
    'https://jobs.ashbyhq.com/fabrikam/' + ashbyId + '/other',
    `https://jobs.ashbyhq.com/${'a'.repeat(81)}/${ashbyId}`,
    'https://jobs.lever.co/contoso-robotics/123',
    // Board pages and company pages that do not name the board.
    'https://boards.greenhouse.io/northwindlabs',
    'https://jobs.ashbyhq.com/fabrikam',
    'https://jobs.lever.co/contoso-robotics',
    'https://careers.example.com/jobs?gh_jid=4010001001',
    `https://careers.example.com/jobs?ashby_jid=${ashbyId}`,
    'https://careers.example.com/jobs?gh_jid=4010001001&for=bad/board',
    '',
    '   ',
    'not a url',
    'https://constructor/acme/jobs/1',
    'https://__proto__/acme/jobs/1',
    `https://jobs.lever.co/contoso-robotics/${leverId}?q=${'x'.repeat(2000)}`,
  ])('does not recognize %j', (value) => {
    expect(link(value)).toBeNull();
    expect(reason(value)).toMatch(/\.$/);
  });

  it('explains why a link was not recognized in plain words', () => {
    expect(reason('')).toBe('Paste a job posting link.');
    expect(reason('http://jobs.lever.co/acme/' + leverId)).toBe(
      'Use an https link to the job posting.',
    );
    expect(reason('https://example.com/careers')).toBe(
      'This link is not a Greenhouse, Ashby, Lever, Comeet or Workable job posting.',
    );
    expect(reason('https://careers.example.com/?gh_jid=1')).toContain('does not name the board');
    expect(reason(`https://jobs.eu.lever.co/acme/${leverId}`)).toBe(
      'Lever EU boards are not supported yet.',
    );
    expect(reason('https://jobs.ashbyhq.com/fabrikam/123')).toBe(
      'The Ashby job ID in this link is not valid.',
    );
  });
});

const token = 'FictionalToken0123456789';

describe('Ashby board names with dots and spaces', () => {
  it.each([
    [`https://jobs.ashbyhq.com/example.io/${ashbyId}`, 'example.io', 'example.io'],
    [`https://jobs.ashbyhq.com/fabrikam.ai/${ashbyId}/application`, 'fabrikam.ai', 'fabrikam.ai'],
    [
      `https://jobs.ashbyhq.com/Northwind%20Scientific/${ashbyId}`,
      'Northwind Scientific',
      'Northwind%20Scientific',
    ],
    [
      `https://jobs.ashbyhq.com/Northwind%20Scientific/${ashbyId}/application?utm_source=x`,
      'Northwind Scientific',
      'Northwind%20Scientific',
    ],
  ])('reads %s', (value, board, encoded) => {
    expect(link(value)).toEqual({
      provider: 'ashby',
      board,
      jobId: ashbyId,
      url: `https://jobs.ashbyhq.com/${encoded}/${ashbyId}`,
    });
  });

  it.each([
    `https://jobs.ashbyhq.com/fabrikam%2Fadmin/${ashbyId}`,
    `https://jobs.ashbyhq.com/fabrikam%2fadmin/${ashbyId}`,
    `https://jobs.ashbyhq.com/%2E%2E/${ashbyId}`,
    `https://jobs.ashbyhq.com/fabrikam%2E/${ashbyId}`,
    `https://jobs.ashbyhq.com/fabrikam%25/${ashbyId}`,
    `https://jobs.ashbyhq.com/Northwind%2520Scientific/${ashbyId}`,
    `https://jobs.ashbyhq.com/Northwind%20%20Scientific/${ashbyId}`,
    `https://jobs.ashbyhq.com/%20fabrikam/${ashbyId}`,
    `https://jobs.ashbyhq.com/fabrikam%20/${ashbyId}`,
    `https://jobs.ashbyhq.com/fabrikam..io/${ashbyId}`,
    `https://jobs.ashbyhq.com/.fabrikam/${ashbyId}`,
    `https://jobs.ashbyhq.com/fabrikam/..%20/${ashbyId}`,
    `https://jobs.ashbyhq.com/fabrikam/${ashbyId}%20`,
    `https://jobs.ashbyhq.com/a/../fabrikam/${ashbyId}`,
    `https://jobs.ashbyhq.com//fabrikam/${ashbyId}`,
    `https://jobs.ashbyhq.com/Northwind Scientific/${ashbyId}`,
    `https://jobs.lever.co/contoso%20robotics/${leverId}`,
    'https://boards.greenhouse.io/north%20wind/jobs/4010001001',
    'https://apply.workable.com/lit%20ware/j/3F2A1B0C9D',
  ])('still rejects %s', (value) => {
    expect(link(value)).toBeNull();
  });
});

describe('Comeet links', () => {
  it('reads a hosted posting link without a token', () => {
    const value = 'https://www.comeet.com/jobs/northwind/A1.B2C/frontend-engineer/C3.D4E';
    expect(link(value)).toEqual({
      provider: 'comeet',
      board: 'A1.B2C',
      jobId: 'C3.D4E',
      url: value,
    });
    expect(link(value.replace('www.', ''))?.jobId).toBe('C3.D4E');
    expect(link(`${value}/`)?.board).toBe('A1.B2C');
  });

  it('reads an embed link and keeps its token only on the link', () => {
    for (const suffix of ['', '/apply'])
      expect(
        link(`https://www.comeet.co/jobs/A1.B2C/C3.D4E${suffix}?token=${token}&embedded=true`),
      ).toEqual({
        provider: 'comeet',
        board: 'A1.B2C',
        jobId: 'C3.D4E',
        url: 'https://www.comeet.co/jobs/A1.B2C/C3.D4E',
        token,
      });
    expect(link('https://www.comeet.co/jobs/A1.B2C/C3.D4E')).toEqual({
      provider: 'comeet',
      board: 'A1.B2C',
      jobId: 'C3.D4E',
      url: 'https://www.comeet.co/jobs/A1.B2C/C3.D4E',
    });
  });

  it.each([
    'https://www.comeet.com/jobs/northwind/A1.B2C',
    'https://www.comeet.com/jobs/northwind/A1.B2C/frontend-engineer',
    'https://www.comeet.com/jobs/northwind/A1..B2/frontend-engineer/C3.D4E',
    'https://www.comeet.com/jobs/northwind/A1.B2C.D/frontend-engineer/C3.D4E',
    'https://www.comeet.com/jobs/northwind/A1.B2C/frontend-engineer/C3D4E',
    'https://www.comeet.com/jobs/-northwind/A1.B2C/frontend-engineer/C3.D4E',
    'https://www.comeet.com/jobs/north%20wind/A1.B2C/frontend-engineer/C3.D4E',
    'https://www.comeet.com/careers/northwind/A1.B2C/frontend-engineer/C3.D4E',
    'https://www.comeet.co/jobs/A1.B2C/C3.D4E/other',
    'https://www.comeet.co/careers-api/2.0/company/A1.B2C/positions?token=' + token,
    'https://comeet.example/jobs/northwind/A1.B2C/frontend-engineer/C3.D4E',
  ])('does not recognize %s', (value) => {
    expect(link(value)).toBeNull();
  });

  it('rejects a malformed embed token without repeating it', () => {
    const bad = 'short';
    const message = reason(`https://www.comeet.co/jobs/A1.B2C/C3.D4E?token=${bad}`);
    expect(message).toBe('The Comeet token in this link is not valid.');
    expect(message).not.toContain(bad);
  });
});

describe('Workable links', () => {
  it.each([
    'https://apply.workable.com/litware/j/3F2A1B0C9D',
    'https://apply.workable.com/litware/j/3F2A1B0C9D/',
    'https://apply.workable.com/litware/j/3F2A1B0C9D/apply',
    'https://apply.workable.com/litware/j/3F2A1B0C9D/?utm_source=board',
  ])('reads %s', (value) => {
    expect(link(value)).toEqual({
      provider: 'workable',
      board: 'litware',
      jobId: '3F2A1B0C9D',
      url: 'https://apply.workable.com/litware/j/3F2A1B0C9D/',
    });
  });

  it.each([
    'https://apply.workable.com/litware/j/3f2a1b0c9d',
    'https://apply.workable.com/litware/j/3F2A1',
    'https://apply.workable.com/litware/j/3F2A1B0C9D0E1',
    'https://apply.workable.com/litware/j/3F2A1B0C9D/other',
    'https://apply.workable.com/litware/3F2A1B0C9D',
    'https://apply.workable.com/litware',
    'https://apply.workable.com/lit.ware/j/3F2A1B0C9D',
    'https://apply.workable.com/j/3F2A1B0C9D',
    'https://litware.workable.com/j/3F2A1B0C9D',
  ])('does not recognize %s', (value) => {
    expect(link(value)).toBeNull();
  });

  it('explains that a short Workable link has no account', () => {
    expect(reason('https://apply.workable.com/j/3F2A1B0C9D')).toContain(
      'does not name the company',
    );
  });
});

describe('job link provenance', () => {
  it('accepts only a known provider, a valid board name and a matching job ID', () => {
    const valid = { provider: 'lever', board: 'contoso-robotics', jobId: leverId };
    expect(jobLinkProvenance.parse(valid)).toEqual({ ...valid, postedAt: null });
    for (const patch of [
      { provider: 'workday' },
      { provider: '__proto__' },
      { provider: 'constructor' },
      { board: '../admin' },
      { jobId: '4010001001' },
      { postedAt: 'yesterday' },
      { sourceId: 'other' },
    ])
      expect(
        jobLinkProvenance.safeParse({ ...valid, ...patch }).success,
        JSON.stringify(patch),
      ).toBe(false);
    expect(
      jobLinkProvenance.safeParse({ provider: 'greenhouse', board: 'acme', jobId: leverId })
        .success,
    ).toBe(false);
  });
});
