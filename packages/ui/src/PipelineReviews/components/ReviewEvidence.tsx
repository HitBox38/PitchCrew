import type { PipelineEvidence } from '@pitchcrew/core';
import { evidenceDetails } from '../helpers.ts';

export function ReviewEvidence({ event }: { event: PipelineEvidence }) {
  return (
    <div className="space-y-1 py-2">
      <p>
        Reference #{event.eventId} / {new Date(event.createdAt).toLocaleString()}
      </p>
      <p>{event.message}</p>
      {evidenceDetails(event.summary).map((detail, index) => (
        <p key={`${index}:${detail}`}>{detail}</p>
      ))}
    </div>
  );
}
