import { ShieldCheck } from 'lucide-react';
import { writerNote } from '../helpers';
import { profileFile } from '../constants';
import type { Claim } from '../types';

export function ReviewNote({
  claim,
  className = '',
  writer = false,
}: {
  claim: Claim;
  className?: string;
  writer?: boolean;
}) {
  return (
    <div className={`review-note ${className}`}>
      <p className="note-who">
        <span className="role-mark" data-role="reviewer">
          <ShieldCheck size={15} aria-hidden="true" />
        </span>
        Reviewer
        <span className="note-verdict" data-verdict={claim.verdict}>
          {claim.verdict === 'quoted' ? 'Agreed' : 'Changed, then agreed'}
        </span>
      </p>
      <p className="note-text">{claim.note}</p>
      {claim.draft ? (
        <p className="note-draft">
          <span>First draft</span>
          <del>{claim.draft}</del>
        </p>
      ) : null}
      <figure className="note-quote">
        <blockquote>{claim.text}</blockquote>
        <figcaption>
          <span className="sr-only">Source: </span>
          {profileFile} · line {claim.line}
        </figcaption>
      </figure>
      {writer ? <p className="note-writer">Writer: {writerNote(claim)}</p> : null}
    </div>
  );
}
