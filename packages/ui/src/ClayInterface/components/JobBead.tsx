import type { BeadTone } from '../helpers.ts';
import type { JobSignal } from '../signals.ts';

/** A spinner while an agent works, an ochre bead when the user is asked, else the stage tone. */
export const JobBead = ({ tone, signal }: { tone?: BeadTone; signal: JobSignal }) => {
  if (signal.run && !signal.decision)
    return <span className="clay-job-spinner" aria-hidden="true" />;
  return (
    <span
      className="clay-bead"
      data-size="sm"
      data-tone={signal.decision ? 'ochre' : tone}
      aria-hidden="true"
    />
  );
};
