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
      'This link is not a Greenhouse, Ashby or Lever job posting.',
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
