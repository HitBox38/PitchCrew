import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { DocumentFind } from '../hooks/useDocumentFind.ts';
export const FindBar = ({
  find: {
    attachInput,
    query,
    setQuery,
    next,
    count,
    index,
    matchCase,
    setMatchCase,
    wholeWord,
    setWholeWord,
  },
  close,
  scope,
}: {
  find: DocumentFind;
  close: () => void;
  scope: string;
}) => (
  <search className="file-findbar" aria-label={`Find in ${scope}`}>
    <span className="quiet">{scope}</span>
    <Input
      ref={attachInput}
      aria-label="Find in document"
      placeholder="Find in document…"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          next(event.shiftKey ? -1 : 1);
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    />
    <output aria-live="polite">
      {query ? (count ? `${index} of ${count}` : 'No matches') : 'Enter text'}
    </output>
    <Button
      size="icon"
      variant="ghost"
      aria-label="Previous match"
      disabled={!count}
      onClick={() => next(-1)}
    >
      <ArrowUp size={16} />
    </Button>
    <Button
      size="icon"
      variant="ghost"
      aria-label="Next match"
      disabled={!count}
      onClick={() => next(1)}
    >
      <ArrowDown size={16} />
    </Button>
    <Button
      size="sm"
      variant="ghost"
      aria-pressed={matchCase}
      onClick={() => setMatchCase(!matchCase)}
    >
      Match case
    </Button>
    <Button
      size="sm"
      variant="ghost"
      aria-pressed={wholeWord}
      onClick={() => setWholeWord(!wholeWord)}
    >
      Whole word
    </Button>
    <Button size="icon" variant="ghost" aria-label="Close find" onClick={close}>
      <X size={16} />
    </Button>
  </search>
);
