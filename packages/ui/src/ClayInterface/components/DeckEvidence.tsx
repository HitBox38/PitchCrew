import type { Snapshot } from '@pitchcrew/core';
import { Check, FileText } from 'lucide-react';
import type { Decision } from '../signals.ts';

/**
 * Real facts behind the top decision: the passing Reviewer's highlights and the frozen files for a
 * packet, or the agent's own words for a question or browser request. Nothing is invented.
 */
export const DeckEvidence = ({ decision, data }: { decision: Decision; data: Snapshot }) => {
  if (decision.kind === 'question' || decision.kind === 'browser')
    return <p className="clay-deck-detail">{decision.detail}</p>;
  if (decision.kind !== 'packet') return null;
  const approval = data.approvals.find((item) => item.id === decision.id);
  const card = data.cards.find((item) => item.id === decision.cardId);
  const review = card?.packetReview;
  const highlights =
    review?.summary && review.packetDigest === approval?.digest
      ? review.summary.highlights.slice(0, 3)
      : [];
  const files = approval?.artifacts ?? [];
  if (!highlights.length && !files.length) return null;
  return (
    <div className="clay-deck-evidence">
      {files.length ? (
        <ul className="clay-deck-files" aria-label="Packet files">
          {files.map((file) => (
            <li key={file.name}>
              <FileText size={13} aria-hidden="true" />
              {file.name}
              {data.artifactPages?.[file.digest]
                ? ` · ${data.artifactPages[file.digest]} ${data.artifactPages[file.digest] === 1 ? 'page' : 'pages'}`
                : ''}
            </li>
          ))}
        </ul>
      ) : null}
      {highlights.length ? (
        <ul className="clay-deck-highlights" aria-label="Reviewer highlights">
          {highlights.map((line) => (
            <li key={line}>
              <Check size={13} aria-hidden="true" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
