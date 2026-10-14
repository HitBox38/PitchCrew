'use client';

import { LazyMotion, MotionConfig, domMax } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { claims, initialClaim } from '../constants';
import { announcement } from '../helpers';
import { ClaimList } from './ClaimList';
import { ReviewRail } from './ReviewRail';

export function ClaimTracer({ intro, footer }: { intro: ReactNode; footer: ReactNode }) {
  const [selected, select] = useState(initialClaim);
  const [preview, setPreview] = useState<string | null>(null);
  const shown = claims.find((claim) => claim.id === (preview ?? selected)) ?? claims[0];
  const chosen = claims.find((claim) => claim.id === selected) ?? claims[0];
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}>
        <div className="thread-stage">
          <div className="thread-sheet">
            {intro}
            <ClaimList selected={selected} onSelect={select} onPreview={setPreview} />
            <p className="readout inline-readout">
              <strong>
                {claims.length} of {claims.length}
              </strong>
              claims in the final packet quoted from your notes
              <span>1 change requested and fixed before review passed</span>
            </p>
            {footer}
          </div>
          <ReviewRail claim={shown} />
        </div>
        <p className="sr-only" aria-live="polite">
          {announcement(chosen)}
        </p>
      </MotionConfig>
    </LazyMotion>
  );
}
