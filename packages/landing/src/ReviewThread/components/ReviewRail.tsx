'use client';

import { PenLine } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { claims } from '../constants';
import { writerNote } from '../helpers';
import type { Claim } from '../types';
import { ReviewNote } from './ReviewNote';

export const ReviewRail = ({ claim }: { claim: Claim }) => {
  const reduced = useReducedMotion();
  return (
    <aside className="thread-rail" aria-label="Review notes">
      <h2 className="rail-title">Review notes</h2>
      <div className="rail-note">
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={claim.id}
            initial={reduced ? false : { opacity: 0, y: 6, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduced ? undefined : { opacity: 0, y: -4, filter: 'blur(2px)' }}
          >
            <ReviewNote claim={claim} />
          </m.div>
        </AnimatePresence>
      </div>
      <div className="writer-note">
        <p className="note-who">
          <span className="role-mark" data-role="writer">
            <PenLine size={15} aria-hidden="true" />
          </span>
          Writer
        </p>
        <p className="note-text">{writerNote(claim)}</p>
      </div>
      <p className="readout">
        <strong>
          {claims.length} of {claims.length}
        </strong>
        claims in the final packet quoted from your notes
        <span>{revised} change requested and fixed before review passed</span>
      </p>
    </aside>
  );
};

const revised = claims.filter((claim) => claim.verdict === 'revised').length;
