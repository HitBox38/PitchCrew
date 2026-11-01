'use client';

import { Bead } from '../components/clay/Bead';
import { ApprovalBar } from './components/ApprovalBar';
import { ClaimList } from './components/ClaimList';
import { ReviewerNote } from './components/ReviewerNote';
import { useSelection } from './hooks/useSelection';

export const Packet = () => {
  const { selected, select, shown, enter, leave, decision, decide } = useSelection();
  return (
    <section id="packet" className="section packet" aria-labelledby="packet-title">
      <div className="page-width section-head">
        <h2 id="packet-title" className="headline">
          Every line traces back to you.
        </h2>
        <p className="section-copy">
          Pick a line to see how Reviewer checked it against your notes.
        </p>
      </div>
      <div className="page-width">
        <div className="sheet packet-sheet" data-ui="" data-decision={decision}>
          <div className="packet-top">
            <p className="packet-pager">
              Decisions <span className="tabular">1 of 1</span>
            </p>
            <p className="packet-id">
              <span className="fictional">Fictional packet</span>
              Resume · Forma, Design Engineer
            </p>
            <p className="packet-readout" aria-live="polite">
              <span className="packet-beads" aria-hidden="true">
                <Bead tone="moss" size="sm" />
                <Bead tone="moss" size="sm" />
                <Bead tone="moss" size="sm" />
                <Bead tone="primary" size="sm" />
              </span>
              4 of 4 claims quoted
            </p>
          </div>
          <div className="packet-body">
            <ClaimList selected={selected} onSelect={select} onEnter={enter} onLeave={leave} />
            <ReviewerNote claim={shown} />
          </div>
          <ApprovalBar decision={decision} onDecide={decide} />
        </div>
      </div>
    </section>
  );
};
