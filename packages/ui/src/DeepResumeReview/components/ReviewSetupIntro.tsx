import type { Card, Role } from '@pitchcrew/core';
import { runtimeLabels } from '@/lib/labels.ts';

// A seat named after its role ("Reviewer: Reviewer") is stated once.
const seat = (label: string, role: Role) =>
  `${role.name === label ? label : `${label}: ${role.name}`} · ${runtimeLabels[role.runtime]} · ${role.model || 'CLI default'}`;

/** What the review does, in its three steps, and which crew runs it. */
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
    <div className="grid gap-3">
      <p>
        Check the {card.title} resume for {card.company} against the confirmed brief, then fix what
        the evidence supports.
      </p>
      <ol className="deep-review-plan">
        <li>Reviewer reads it through seven hiring perspectives.</li>
        <li>Writer makes the supported corrections, drafting first if needed.</li>
        <li>Reviewer rechecks the whole packet.</li>
      </ol>
      {/* Who runs it, on one quiet line; a missing seat is an alert instead. */}
      {reviewer && writer ? (
        <p className="deep-review-seats">
          <span>{seat('Reviewer', reviewer)}</span>
          <span>{seat('Writer', writer)}</span>
        </p>
      ) : null}
      {reviewer ? null : <p role="alert">Enable a Reviewer in Crew first.</p>}
      {writer ? null : <p role="alert">Enable a Writer in Crew first.</p>}
    </div>
  );
};
