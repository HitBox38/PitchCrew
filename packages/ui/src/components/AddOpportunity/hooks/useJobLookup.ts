import type { JobLookupDuplicate, JobLookupPrefill } from '@pitchcrew/core';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { lookupJob } from '../api.ts';
import { fillJobForm, snapshotJobForm } from '../helpers.ts';

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
  const lastPrefill = useRef<JobLookupPrefill | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function changeLink() {
    controller.current?.abort();
    setState(idle);
  }
  async function fetchFromLink(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    const url = form?.elements.namedItem('url');
    if (!form || !(url instanceof HTMLInputElement)) return;
    const requestedUrl = url.value;
    const initial = snapshotJobForm(form);
    const previous = lastPrefill.current;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState({ ...idle, pending: true });
    try {
      const result = await lookupJob(requestedUrl, current.signal);
      if (current.signal.aborted) return;
      if (url.value !== requestedUrl) return setState(idle);
      if (result.status !== 'found') return setState({ ...idle, message: result.reason });
      fillJobForm(form, result.prefill, previous, initial);
      lastPrefill.current = result.prefill;
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
  return { ...state, fetchFromLink, changeLink };
}
