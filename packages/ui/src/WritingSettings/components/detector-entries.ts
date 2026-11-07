import type { DetectorProvider } from '@pitchcrew/core';

/** Display copy for Settings; limits and request contracts live in core and the daemon. */
export const detectorEntries: Record<
  DetectorProvider,
  { name: string; docsUrl: string; note: string; secondary?: string }
> = {
  sapling: {
    name: 'Sapling',
    docsUrl: 'https://sapling.ai/docs/api/detector/',
    note: 'Per-character billing. Pitchcrew asks Sapling not to retain the text.',
  },
  copyleaks: {
    name: 'Copyleaks',
    docsUrl: 'https://docs.copyleaks.com/reference/actions/writer-detector/check',
    note: 'Credits per scan. Retention for this endpoint is not documented; check your terms.',
    secondary: 'Copyleaks account email',
  },
  gptzero: {
    name: 'GPTZero',
    docsUrl: 'https://docs.gptzero.me/',
    note: 'Requires a paid plan with API access.',
  },
  originality: {
    name: 'Originality.ai',
    docsUrl: 'https://docs.originality.ai/',
    note: 'Credits per 100 words. Opt out of training in your account; scans are sent as not stored.',
  },
};
