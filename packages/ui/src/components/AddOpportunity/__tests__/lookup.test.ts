import type { JobLookupResult } from '@pitchcrew/core';
import type { MouseEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupJob } from '../api.ts';
import { useJobLookup } from '../hooks/useJobLookup.ts';

const { state } = vi.hoisted(() => ({ state: vi.fn() }));
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: (value: unknown) => [value, state],
  useRef: (value: unknown) => ({ current: value }),
  useEffect: vi.fn(),
}));
vi.mock('../api.ts', () => ({ lookupJob: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function pendingLookup() {
  class Input {
    value = 'https://job-boards.greenhouse.io/example/jobs/123';
  }
  vi.stubGlobal('HTMLInputElement', Input);
  const url = new Input();
  const company = { value: 'My typed company' };
  const title = { value: 'Original title' };
  const fields: Record<string, { value: string }> = { url, company, title };
  const form = { elements: { namedItem: (name: string) => fields[name] } };
  let complete!: (result: JobLookupResult) => void;
  vi.mocked(lookupJob).mockImplementationOnce(() => new Promise((resolve) => (complete = resolve)));
  const controller = useJobLookup();
  const pending = controller.fetchFromLink({
    currentTarget: { form },
  } as unknown as MouseEvent<HTMLButtonElement>);
  return { controller, pending, complete, url, company, title, fields };
}
const result: JobLookupResult = {
  status: 'found',
  prefill: {
    company: 'Fetched company',
    title: 'Engineer',
    location: '',
    url: 'https://job-boards.greenhouse.io/example/jobs/123',
    salary: '',
    description: '',
    jobIdentifier: '123',
    provenance: { provider: 'greenhouse', board: 'example', jobId: '123', postedAt: null },
  },
  duplicates: [],
};

describe('pending job lookups', () => {
  it.each(['Updated by the user', ''])(
    'preserves a company edit to %j while filling fields left unchanged',
    async (company) => {
      const lookup = pendingLookup();
      lookup.company.value = company;
      lookup.complete(result);
      await lookup.pending;
      expect(lookup.company.value).toBe(company);
      expect(lookup.title.value).toBe('Engineer');
      expect(state).toHaveBeenLastCalledWith(
        expect.objectContaining({ pending: false, prefill: result.prefill }),
      );
    },
  );
  it('preserves an edit in an optional field mounted while the lookup is pending', async () => {
    const lookup = pendingLookup();
    lookup.fields.jobIdentifier = { value: 'User-entered identifier' };
    lookup.complete(result);
    await lookup.pending;
    expect(lookup.fields.jobIdentifier.value).toBe('User-entered identifier');
    expect(lookup.title.value).toBe('Engineer');
  });

  it('aborts and clears lookup notices when the user edits the link', async () => {
    const lookup = pendingLookup();
    const signal = vi.mocked(lookupJob).mock.calls[0][1];
    lookup.controller.changeLink();
    expect(signal?.aborted).toBe(true);
    lookup.complete(result);
    await lookup.pending;
    expect(lookup.company.value).toBe('My typed company');
    expect(state).toHaveBeenLastCalledWith({
      pending: false,
      message: '',
      prefill: null,
      duplicates: [],
    });
  });

  it('ignores a stale response even if the URL changes without a React input event', async () => {
    const lookup = pendingLookup();
    lookup.url.value = 'https://careers.example.com/another';
    lookup.complete(result);
    await lookup.pending;
    expect(lookup.url.value).toBe('https://careers.example.com/another');
    expect(lookup.company.value).toBe('My typed company');
    expect(state).toHaveBeenLastCalledWith({
      pending: false,
      message: '',
      prefill: null,
      duplicates: [],
    });
  });
});
