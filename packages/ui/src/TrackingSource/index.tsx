import type { TrackingSignal } from '@pitchcrew/core';

export function TrackingSource({ signal }: { signal: TrackingSignal }) {
  return (
    <>
      <blockquote className="my-2 border-l-2 border-border pl-3 whitespace-pre-wrap">
        {signal.quote}
      </blockquote>
      <details className="my-2">
        <summary>Read fetched email{signal.sourceTruncated ? ' (incomplete source)' : ''}</summary>
        <p className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap">{signal.sourceText}</p>
      </details>
    </>
  );
}
