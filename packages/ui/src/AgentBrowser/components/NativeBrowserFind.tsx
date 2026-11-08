import { useEffect, useRef, useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import { X, ArrowDown, ArrowUp, Search } from 'lucide-react';
import { BrowserFindCount } from './BrowserFindCount.tsx';

type Matches = { active: number; total: number } | null;

/**
 * Find on page as a pill floating over the page's top-right corner: it never pushes the page
 * down, counts matches and closes on Escape, returning focus to the page.
 */
export const NativeBrowserFind = ({ id, close }: { id: string; close: () => void }) => {
  const [text, setText] = useState('');
  const [matches, setMatches] = useState<Matches>(null);
  const input = useRef<HTMLInputElement>(null);
  // Only the newest search may update the count; superseded or late results are dropped.
  const sequence = useRef(0);
  useEffect(() => {
    input.current?.focus();
    const searches = sequence;
    return () => {
      searches.current++;
      void window.pitchcrewBrowser?.find(id, '', true).catch(() => {});
    };
  }, [id]);
  const find = (query: string, forward: boolean) => {
    const request = ++sequence.current;
    void window.pitchcrewBrowser
      ?.find(id, query, forward)
      .then((result) => {
        if (request === sequence.current) setMatches(query ? (result ?? null) : null);
      })
      .catch(() => {
        if (request === sequence.current) setMatches(null);
      });
  };
  const finish = () => {
    close();
    void window.pitchcrewBrowser?.focusPage(id).catch(() => {});
  };
  return (
    <form
      className="browser-find"
      onSubmit={(event) => {
        event.preventDefault();
        find(text, true);
      }}
    >
      <Search size={14} aria-hidden="true" />
      <input
        ref={input}
        aria-label="Find on page"
        placeholder="Find on page"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          find(event.target.value, true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            finish();
          }
          if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault();
            find(text, false);
          }
        }}
      />
      <BrowserFindCount text={text} matches={matches} />
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Previous match"
        title="Previous match (Shift+Enter)"
        disabled={!text || !matches?.total}
        onClick={() => find(text, false)}
      >
        <ArrowUp size={14} />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Next match"
        title="Next match (Enter)"
        disabled={!text || !matches?.total}
        type="submit"
      >
        <ArrowDown size={14} />
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Close page search" onClick={finish}>
        <X size={14} />
      </Button>
    </form>
  );
};
