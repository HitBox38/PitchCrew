import { Button } from '@pitchcrew/design-system/button';
import { Check, X } from 'lucide-react';

type ProposalFooterProps = {
  note: string;
  path: string;
  approveLabel: string;
  working: boolean;
  blocked?: boolean;
  act: (path: string, body?: unknown) => void;
  /**
   * Home's desk: the approve verb leads at the left, then Decline, with the note under them as
   * the row's consequence line. Chat keeps the note first and Decline before the approve verb.
   */
  approveFirst?: boolean;
};

/** The note and Decline/approve pair every proposal ends with; both post the same decision. */
export const ProposalFooter = ({
  note,
  path,
  approveLabel,
  working,
  blocked = false,
  act,
  approveFirst = false,
}: ProposalFooterProps) => {
  const decline = (
    <Button className="button" disabled={working} onClick={() => act(path, { approved: false })}>
      <X size={14} /> Decline
    </Button>
  );
  const approve = (
    <Button
      className="button primary"
      disabled={working || blocked}
      onClick={() => act(path, { approved: true })}
    >
      <Check size={14} /> {approveLabel}
    </Button>
  );
  if (approveFirst)
    return (
      <footer>
        <div>
          {approve}
          {decline}
        </div>
        <p>{note}</p>
      </footer>
    );
  return (
    <footer>
      <p>{note}</p>
      <div>
        {decline}
        {approve}
      </div>
    </footer>
  );
};
