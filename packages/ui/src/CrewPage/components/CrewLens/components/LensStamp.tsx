import type { LensTone, Stamp } from '@/lib/crew-lens.ts';

type LensStampProps = { stamp: Stamp; tone?: LensTone; className?: string };

/**
 * "waiting 4m", "oldest failed 05:47 AM": the state word in its bead's tone when it waits on the
 * user or failed, around it a group's "oldest" and the time in quiet ink.
 */
export const LensStamp = ({ stamp, tone, className = 'crew-lens-stamp' }: LensStampProps) => (
  <span className={className}>
    {stamp.lead ? `${stamp.lead} ` : null}
    <span data-tone={tone}>{stamp.word}</span>
    {stamp.time ? ` ${stamp.time}` : null}
  </span>
);
