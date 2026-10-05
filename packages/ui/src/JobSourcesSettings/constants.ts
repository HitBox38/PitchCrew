import { jobProviderLabels } from '../lib/labels.ts';
import type { JobProvider } from '@pitchcrew/core';
import type { SourceDraft } from './types.ts';

const providers: JobProvider[] = ['greenhouse', 'ashby', 'lever', 'comeet', 'workable'];
export const providerOptions: { value: JobProvider; label: string }[] = providers.map((value) => ({
  value,
  label: jobProviderLabels[value],
}));
/** Providers that also need a public careers token next to the board identifier. */
export const tokenProviders: ReadonlySet<JobProvider> = new Set<JobProvider>(['comeet']);
export const boardExamples: Record<JobProvider, string> = {
  greenhouse: 'job-boards.greenhouse.io/examplelabs',
  ashby: 'jobs.ashbyhq.com/examplelabs',
  lever: 'jobs.lever.co/examplelabs',
  comeet: 'comeet.com/jobs/examplelabs/A1.B2C',
  workable: 'apply.workable.com/examplelabs',
};
export const boardLabels: Record<JobProvider, string> = {
  greenhouse: 'Board name or link',
  ashby: 'Board name or link',
  lever: 'Board name or link',
  comeet: 'Company UID or link',
  workable: 'Account name or link',
};
const boardNameHelp =
  "The name after the provider's domain in the company's job board link. Pasting the link also works.";
export const boardHelp: Record<JobProvider, string> = {
  greenhouse: boardNameHelp,
  ashby: boardNameHelp,
  lever: boardNameHelp,
  comeet:
    "The code with a dot in the company's Comeet jobs link, such as A1.B2C in comeet.com/jobs/examplelabs/A1.B2C. Pasting the link fills it in.",
  workable:
    "The name after apply.workable.com/ in the company's Workable jobs link. Pasting the link also works.",
};
export const tokenHelp =
  "Comeet careers pages load their jobs with a public token. Open the company's careers page, view the page source and search for token. The company UID is usually next to it. Pasting a Comeet careers API link fills in both fields.";
export const emptyDraft: SourceDraft = {
  provider: 'greenhouse',
  slug: '',
  token: '',
  name: '',
  enabled: true,
  titleInclude: '',
  titleExclude: '',
  locationInclude: '',
  remoteOnly: false,
};
