import type { JobLookupDuplicate, JobLookupPrefill } from '@pitchcrew/core';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { lookupJob } from '../api.ts';
import { fillJobForm } from '../helpers.ts';

export interface JobLookupState {
  pending: boolean;
  message: string;
  prefill: JobLookupPrefill | null;
  duplicates: JobLookupDuplicate[];
}
const idle: JobLookupState = { pending: false, message: '', prefill: null, duplicates: [] };

/** Fetch a pasted posting link and fill the Add job form for the user to review. */
export function useJobLookup() {
  const [state, setState] = useState<JobLookupState>(idle);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function fetchFromLink(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    const url = form?.elements.namedItem('url');
    if (!form || !(url instanceof HTMLInputElement)) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState({ ...idle, pending: true });
    try {
      const result = await lookupJob(url.value, current.signal);
      if (current.signal.aborted) return;
      if (result.status !== 'found') return setState({ ...idle, message: result.reason });
      fillJobForm(form, result.prefill);
      setState({
        pending: false,
        message: 'Filled from the posting. Review the details before you add the job.',
        prefill: result.prefill,
        duplicates: result.duplicates,
      });
    } catch (error) {
      if (current.signal.aborted) return;
      setState({
        ...idle,
        message: error instanceof Error ? error.message : 'Could not read the job posting.',
      });
    }
  }
  return { ...state, fetchFromLink };
}
