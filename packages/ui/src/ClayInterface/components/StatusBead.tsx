import { statusTone, type BeadStatus } from '../helpers.ts';

/**
 * A run, step or request outcome as one bead: a spinner while running, hollow when queued or
 * stopped. A label is read to screen readers in place of the bead.
 */
export const StatusBead = ({ status, label }: { status: BeadStatus; label?: string }) => {
  const tone = statusTone(status);
  return (
    <>
      {status === 'running' ? (
        <span className="clay-job-spinner" aria-hidden="true" />
      ) : (
        <span
          className="clay-bead"
          data-size="sm"
          data-tone={tone}
          data-empty={tone ? undefined : ''}
          aria-hidden="true"
        />
      )}
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
};
