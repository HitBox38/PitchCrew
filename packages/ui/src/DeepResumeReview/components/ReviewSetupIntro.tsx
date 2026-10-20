import type { Card, Role } from '@pitchcrew/core';
import { runtimeLabels } from '@/lib/labels.ts';
export const ReviewSetupIntro = ({
  card,
  reviewer,
  writer,
}: {
  card: Card;
  reviewer?: Role;
  writer?: Role;
}) => {
  return (
    <div className="space-y-3">
      <p>
        Review {card.title} at {card.company} through seven hiring perspectives. Writer will create
        a draft if needed, make supported corrections, and send it back for a full packet recheck.
      </p>
      {reviewer ? (
        <p>
          Reviewer: {reviewer.name} · {runtimeLabels[reviewer.runtime]} ·{' '}
          {reviewer.model || 'CLI default'}
        </p>
      ) : (
        <p role="alert">Enable a Reviewer in Crew first.</p>
      )}
      {writer ? (
        <p>
          Writer: {writer.name} · {runtimeLabels[writer.runtime]} · {writer.model || 'CLI default'}
        </p>
      ) : (
        <p role="alert">Enable a Writer in Crew first.</p>
      )}
    </div>
  );
};
