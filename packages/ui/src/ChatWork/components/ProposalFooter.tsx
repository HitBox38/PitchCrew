import { Button } from '@/components/ui/button/components/Button.tsx';
import { Check, X } from 'lucide-react';

type ProposalFooterProps = {
  note: string;
  path: string;
  approveLabel: string;
  working: boolean;
  blocked?: boolean;
  act: (path: string, body?: unknown) => void;
};

/** The note and Decline/approve pair every proposal ends with; both post the same decision. */
export const ProposalFooter = ({
  note,
  path,
  approveLabel,
  working,
  blocked = false,
  act,
}: ProposalFooterProps) => {
  return (
    <footer>
      <p>{note}</p>
      <div>
        <Button
          className="button"
          disabled={working}
          onClick={() => act(path, { approved: false })}
        >
          <X size={14} /> Decline
        </Button>
        <Button
          className="button primary"
          disabled={working || blocked}
          onClick={() => act(path, { approved: true })}
        >
          <Check size={14} /> {approveLabel}
        </Button>
      </div>
    </footer>
  );
};
