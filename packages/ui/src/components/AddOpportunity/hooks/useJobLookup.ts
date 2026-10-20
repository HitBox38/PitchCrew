import type { JobLookupDuplicate, JobLookupPrefill } from '@pitchcrew/core';
import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { lookupJob } from '../api.ts';
import { fillJobForm, snapshotJobForm } from '../helpers.ts';

/** Fetch a pasted posting link and fill the Add job form for the user to review. */
export const useJobLookup = () => {
  const changeLink = (event?: ChangeEvent<HTMLInputElement>) => {
    controller.current?.abort();
    setUrl(event?.currentTarget.value ?? '');
    setState(idle);
  };
  const fetchFromLink = async (event: MouseEvent<HTMLButtonElement>) => {
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
      if (result.status !== 'found')
        return setState({
          ...idle,
          message: result.reason,
          scoutUrl: result.status === 'unrecognized' ? requestedUrl.trim() : null,
        });
      fillJobForm(form, result.prefill, previous, initial);
      setUrl(result.prefill.url);
      lastPrefill.current = result.prefill;
      setState({
        pending: false,
        message: 'Filled from the posting. Review the details before you add the job.',
        prefill: result.prefill,
        duplicates: result.duplicates,
        scoutUrl: null,
      });
    } catch (error) {
      if (current.signal.aborted) return;
      setState({
        ...idle,
        message: error instanceof Error ? error.message : 'Could not read the job posting.',
      });
    }
  };

  const [url, setUrl] = useState('');
  const [state, setState] = useState<JobLookupState>(idle);
  const controller = useRef<AbortController | null>(null);
  const lastPrefill = useRef<JobLookupPrefill | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  return { ...state, url, fetchFromLink, changeLink };
};

export interface JobLookupState {
  pending: boolean;
  message: string;
  prefill: JobLookupPrefill | null;
  duplicates: JobLookupDuplicate[];
  scoutUrl: string | null;
}
const idle: JobLookupState = {
  pending: false,
  message: '',
  prefill: null,
  duplicates: [],
  scoutUrl: null,
};
