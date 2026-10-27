import { describe, expect, it } from 'vitest';
import type { Role, Snapshot } from '@pitchcrew/core';
import { capabilityDefaults } from '../../../agent-capabilities.ts';
import { jobLinkAction, scoutJobTarget } from '../link-actions.ts';

const scout = {
  id: 'researcher',
  workflow: 'scout',
  enabled: true,
  runtime: 'codex',
  capabilities: { discoverJobs: true },
} as Role;
const data = {
  roles: [scout],
  runtimes: [{ id: 'codex', available: true }],
} as Pick<Snapshot, 'roles' | 'runtimes'>;

describe('Add job link actions', () => {
  it.each([
    'https://job-boards.greenhouse.io/example/jobs/123',
    'https://jobs.ashbyhq.com/example/6f1c2b3a-1111-4c3d-9e8f-0a1b2c3d4e5f',
    'https://jobs.lever.co/example/a1b2c3d4-0001-4a5b-8c9d-0e1f2a3b4c5d',
    'https://www.comeet.co/jobs/A1.00D/B2.00E',
    'https://apply.workable.com/example/j/A1B2C3D4E5/',
  ])('keeps direct fetching for %s', (url) => expect(jobLinkAction(url)).toBe('fetch'));

  it.each([
    'https://www.linkedin.com/jobs/view/1234567890',
    'https://job-boards.eu.greenhouse.io/example/jobs/123',
  ])('offers Scout for other valid posting links: %s', (url) =>
    expect(jobLinkAction(url)).toBe('scout'),
  );

  it.each([
    'https://careers.example.com/jobs/engineer',
    'https://example.wd5.myworkdayjobs.com/en-US/careers/job/Engineer_R123',
    'http://careers.example.com/jobs/engineer',
    'https://www.upwind.io/careers/co/tel-aviv/CA.042/frontend-software-engineer/all',
    'https://newcore.com/careers/frontend-developer-9e07a',
    'https://careers.doit.com/jobs/7992316003',
    'https://www.hyper.sc/careers/software-engineer-front-end',
    'https://sentrycs.com/careers/co/tlv-israel/0C.37E/fullstack-developer/all/',
    'https://iomodel.tech/career/frontend-developer',
    'https://careers.getborderless.co.uk/jobs/7370306-senior-software-engineer',
    'https://jobs.smartrecruiters.com/ScalableGmbH/744000140438374--senior-frontend-engineer-ai-m-f-x-',
    'https://jobs.smartrecruiters.com/CDPROJEKTRED/744000154614442-frontend-software-engineer',
    'https://apply.careers.dynatrace.com/job/Linz-Senior-Full-Stack-Engineer/1398845900/',
    'https://careers.vidiq.com/o/senior-frontend-engineer-remote-3',
    'https://jobs.jobvite.com/playground-games/job/oajPyfwA',
    'https://hopsule.com/careers/frontend-engineer',
  ])('tries direct fetching for additional public postings: %s', (url) =>
    expect(jobLinkAction(url)).toBe('fetch'),
  );

  it.each([
    '',
    'not a url',
    'https://',
    'javascript:alert(1)',
    'file:///tmp/job.html',
    'https://user:secret@example.com/job',
    'https://example.com:8443/job',
    'https://example.com/job\ninjected',
    `https://example.com/${'x'.repeat(2000)}`,
  ])('does not send invalid links to Scout: %j', (url) =>
    expect(jobLinkAction(url)).toBe('invalid'),
  );

  it('selects an enabled custom Scout with discovery permission and an available runtime', () => {
    expect(
      scoutJobTarget({
        ...data,
        roles: [
          { ...scout, id: 'retired', retiredAt: '2026-01-01' },
          { ...scout, id: 'paused', enabled: false },
          { ...scout, id: 'writer', workflow: 'writer' },
          scout,
        ],
      }),
    ).toEqual({ role: scout, blocker: '' });
  });

  it('explains paused, permission and runtime blockers without enabling anything', () => {
    expect(scoutJobTarget({ ...data, roles: [] }).blocker).toContain('Enable a Scout');
    expect(scoutJobTarget({ ...data, roles: [{ ...scout, enabled: false }] }).role).toBeUndefined();
    expect(
      scoutJobTarget({ ...data, roles: [{ ...scout, capabilities: undefined }] }).blocker,
    ).toContain('Scan saved job sources');
    expect(scoutJobTarget({ ...data, runtimes: [] }).blocker).toContain('Install Scout');
  });

  it('prefers a Scout with browser permission when handing off a posting link', () => {
    const browserScout = {
      ...scout,
      id: 'browser-scout',
      capabilities: { ...capabilityDefaults, ...scout.capabilities, computerUse: true },
    };
    expect(scoutJobTarget({ ...data, roles: [scout, browserScout] }).role).toBe(browserScout);
  });
});
