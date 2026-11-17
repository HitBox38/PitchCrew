import { ArrowDown, ArrowUp, CaseSensitive, WholeWord, X } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { DocumentFind } from '../hooks/useDocumentFind.ts';

/** Match steps, the Match case / Whole word options and Close, at the end of the Find pill. */
export const FindButtons = ({
  find: { next, count, matchCase, setMatchCase, wholeWord, setWholeWord },
  close,
}: {
  find: DocumentFind;
  close: () => void;
}) => (
  <span className="file-findbar-buttons">
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Previous match"
      title="Previous match (Shift+Enter)"
      disabled={!count}
      onClick={() => next(-1)}
    >
      <ArrowUp size={16} />
    </Button>
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Next match"
      title="Next match (Enter)"
      disabled={!count}
      onClick={() => next(1)}
    >
      <ArrowDown size={16} />
    </Button>
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Match case"
      title="Match case"
      aria-pressed={matchCase}
      onClick={() => setMatchCase(!matchCase)}
    >
      <CaseSensitive size={17} />
    </Button>
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Whole word"
      title="Whole word"
      aria-pressed={wholeWord}
      onClick={() => setWholeWord(!wholeWord)}
    >
      <WholeWord size={17} />
    </Button>
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Close find"
      title="Close (Esc)"
      onClick={close}
    >
      <X size={16} />
    </Button>
  </span>
);
