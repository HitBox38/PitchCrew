import { Pebble } from '../../components/clay/Pebble';
import { RoleIcon } from '../../components/clay/RoleIcon';
import { profileFile } from '../constants';
import type { Claim } from '../types';

export const ReviewerNote = ({ claim }: { claim: Claim }) => {
  return (
    <aside className="tray review-rail" aria-label="Reviewer’s check for the chosen line">
      <div key={claim.id} className="review-note">
        <p className="review-who">
          <Pebble agent="reviewer" size={26}>
            <RoleIcon agent="reviewer" size={14} />
          </Pebble>
          Reviewer
        </p>
        <p className="review-text">{claim.note}</p>
        <blockquote className="review-quote">
          <p>“{claim.quote}”</p>
          <cite className="review-source">
            {profileFile} · line {claim.line}
          </cite>
        </blockquote>
        {claim.draft ? (
          <div className="review-writer">
            <p className="review-who">
              <Pebble agent="writer" size={26}>
                <RoleIcon agent="writer" size={14} />
              </Pebble>
              Writer
            </p>
            <p className="review-text">
              Replaced <s>{claim.draft}</s> with the line from your notes.
            </p>
          </div>
        ) : null}
      </div>
    </aside>
  );
};
