import { Search } from 'lucide-react';
import type { DocumentFind } from '../hooks/useDocumentFind.ts';
import { FindButtons } from './FindButtons.tsx';

/**
 * Find as a pill floating over the reading area's top-right corner, so it never pushes the
 * document down. Markdown and DOCX show which view it searches.
 */
export const FindBar = ({
  find,
  close,
  scope,
  scopeLabel,
}: {
  find: DocumentFind;
  close: () => void;
  /** Accessible scope, e.g. "source" or "resume.pdf". */
  scope: string;
  /** Visible scope chip for files with two views. */
  scopeLabel?: string;
}) => {
  const { attachInput, query, setQuery, next, count, index } = find;
  return (
    <search className="file-findbar" aria-label={`Find in ${scope}`}>
      <Search size={15} aria-hidden="true" className="file-findbar-icon" />
      {scopeLabel ? <span className="file-findbar-scope">{scopeLabel}</span> : null}
      <input
        ref={attachInput}
        aria-label="Find in document"
        placeholder="Find in document"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            next(event.shiftKey ? -1 : 1);
          }
        }}
      />
      <output aria-live="polite" data-empty={query && !count ? '' : undefined}>
        {query ? (count ? `${index} of ${count}` : 'No matches') : ''}
      </output>
      <FindButtons find={find} close={close} />
    </search>
  );
};
