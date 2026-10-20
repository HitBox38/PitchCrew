'use client';

import { Check, RefreshCcw } from 'lucide-react';
import { m } from 'motion/react';
import { claims } from '../constants';
import { ReviewNote } from './ReviewNote';

interface ClaimListProps {
  selected: string;
  onSelect: (id: string) => void;
  onPreview: (id: string | null) => void;
}

export const ClaimList = ({ selected, onSelect, onPreview }: ClaimListProps) => {
  return (
    <fieldset className="claim-list" onPointerLeave={() => onPreview(null)}>
      <legend className="claim-legend">
        <span className="claim-legend-chip">Resume</span>
        <span className="packet-meta">
          Application packet · <span className="packet-role">Design Engineer, Forma</span> ·
          fictional candidate
        </span>
        <span className="sr-only">: choose a line to see where it came from</span>
      </legend>
      {claims.map((claim) => {
        const active = claim.id === selected;
        return (
          <div key={claim.id} className="claim-row">
            <label
              className="claim-line"
              data-selected={active ? '' : undefined}
              onPointerEnter={(event) => event.pointerType === 'mouse' && onPreview(claim.id)}
            >
              {active ? <m.span layoutId="claim-highlight" className="claim-highlight" /> : null}
              <input
                type="radio"
                name="claim"
                value={claim.id}
                checked={active}
                onChange={() => onSelect(claim.id)}
                className="sr-only"
              />
              <span className="claim-text">{claim.text}</span>
              <span className="claim-verdict" data-verdict={claim.verdict}>
                {claim.verdict === 'quoted' ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <RefreshCcw size={14} aria-hidden="true" />
                )}
                {claim.verdict === 'quoted' ? 'Quoted' : 'Revised'}
              </span>
            </label>
            {active ? <ReviewNote claim={claim} className="inline-note" writer /> : null}
          </div>
        );
      })}
    </fieldset>
  );
};
