import type { JobProvider } from '@pitchcrew/core';
import type { SourceDraft } from './types.ts';

export const providerOptions: { value: JobProvider; label: string }[] = [
  { value: 'greenhouse', label: 'Greenhouse' },
  { value: 'ashby', label: 'Ashby' },
  { value: 'lever', label: 'Lever' },
];
export const providerLabels: Record<JobProvider, string> = {
  greenhouse: 'Greenhouse',
  ashby: 'Ashby',
  lever: 'Lever',
};
export const boardExamples: Record<JobProvider, string> = {
  greenhouse: 'job-boards.greenhouse.io/examplelabs',
  ashby: 'jobs.ashbyhq.com/examplelabs',
  lever: 'jobs.lever.co/examplelabs',
};
/** Public board hosts a pasted link may use; the server still validates the board name. */
export const boardHosts: { host: RegExp; provider: JobProvider }[] = [
  { host: /^(?:job-)?boards\.greenhouse\.io$/, provider: 'greenhouse' },
  { host: /^boards-api\.greenhouse\.io$/, provider: 'greenhouse' },
  { host: /^jobs\.ashbyhq\.com$/, provider: 'ashby' },
  { host: /^jobs\.lever\.co$/, provider: 'lever' },
];
export const emptyDraft: SourceDraft = {
  provider: 'greenhouse',
  slug: '',
  name: '',
  enabled: true,
  titleInclude: '',
  titleExclude: '',
  locationInclude: '',
  remoteOnly: false,
};
