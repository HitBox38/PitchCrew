import type { BeadTone } from '../helpers.ts';
import { signalAsks, type JobSignal } from '../signals.ts';

/**
 * A spinner while an agent works, an ochre bead when the user is asked, else the job's place at
 * rest (an empty socket for a lead).
 */
export const JobBead = ({ tone, signal }: { tone?: BeadTone; signal: JobSignal }) => {
  const asks = signalAsks(signal);
  if (signal.run && !asks) return <span className="clay-job-spinner" aria-hidden="true" />;
  const shown = asks ? 'ochre' : tone;
  return (
    <span
      className="clay-bead"
      data-size="sm"
      data-tone={shown}
      data-empty={shown ? undefined : ''}
      aria-hidden="true"
    />
  );
};
