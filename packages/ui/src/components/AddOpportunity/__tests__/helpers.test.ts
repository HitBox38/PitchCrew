import type { JobLookupPrefill } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { duplicateText, fillJobForm, prefillFields, provenanceFor } from '../helpers.ts';

const prefill: JobLookupPrefill = {
  company: 'Contoso Robotics',
  title: 'Backend Engineer',
  location: 'Remote - Canada',
  url: 'https://jobs.lever.co/contoso-robotics/a1b2c3d4-0001-4a5b-8c9d-0e1f2a3b4c5d',
  salary: '',
  description: 'Build fictional APIs.',
  jobIdentifier: 'a1b2c3d4-0001-4a5b-8c9d-0e1f2a3b4c5d',
  provenance: {
    provider: 'lever',
    board: 'contoso-robotics',
    jobId: 'a1b2c3d4-0001-4a5b-8c9d-0e1f2a3b4c5d',
    postedAt: null,
  },
};

describe('add job from a link', () => {
  it('fills only the fields the posting provides', () => {
    const fields: Record<string, { value: string }> = Object.fromEntries(
      Object.keys(prefillFields(prefill)).map((name) => [name, { value: 'typed' }]),
    );
    delete fields.jobIdentifier;
    fillJobForm({ elements: { namedItem: (name) => fields[name] ?? null } }, prefill);
    expect(fields).toEqual({
      company: { value: 'Contoso Robotics' },
      title: { value: 'Backend Engineer' },
      location: { value: 'Remote - Canada' },
      url: { value: prefill.url },
      salary: { value: 'typed' },
      description: { value: 'Build fictional APIs.' },
    });
  });

  it('clears missing fields from a previous fetch while preserving manual edits', () => {
    const previous = { ...prefill, location: 'London', salary: '£80,000', description: 'Old job' };
    const fields = {
      location: { value: 'London' },
      salary: { value: '£80,000' },
      description: { value: 'My updated description' },
    };
    fillJobForm(
      { elements: { namedItem: (name) => fields[name as keyof typeof fields] } },
      { ...prefill, location: '', salary: '', description: '' },
      previous,
    );
    expect(fields).toEqual({
      location: { value: '' },
      salary: { value: '' },
      description: { value: 'My updated description' },
    });
  });

  it('keeps provenance only while the URL is still the fetched posting', () => {
    expect(provenanceFor(prefill, ` ${prefill.url} `)).toEqual(prefill.provenance);
    expect(provenanceFor(prefill, 'https://careers.example.com/jobs/1')).toBeUndefined();
    expect(provenanceFor(null, prefill.url)).toBeUndefined();
  });

  it('describes possible duplicates in plain words', () => {
    expect(
      duplicateText({ id: '1', company: 'Contoso Robotics', title: 'Backend', state: 'ghosted' }),
    ).toBe('Contoso Robotics: Backend (No response)');
  });
});
