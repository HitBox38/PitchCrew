import { useEffect, useRef, useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import { X, ArrowDown, ArrowUp, Search } from 'lucide-react';

type Matches = { active: number; total: number } | null;

/**
 * Find on page as a pill floating over the page's top-right corner: it never pushes the page
 * down, counts matches and closes on Escape, returning focus to the page.
 */
export const NativeBrowserFind = ({ id, close }: { id: string; close: () => void }) => {
  const [text, setText] = useState('');
  const [matches, setMatches] = useState<Matches>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    return () => {
      void window.pitchcrewBrowser?.find(id, '', true).catch(() => {});
    };
  }, [id]);
  const find = (query: string, forward: boolean) =>
    void window.pitchcrewBrowser
      ?.find(id, query, forward)
      .then((result) => setMatches(query ? (result ?? null) : null))
      .catch(() => setMatches(null));
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
      <output className="browser-find-count" aria-live="polite">
        {text && matches ? `${matches.total ? matches.active : 0}/${matches.total}` : ''}
      </output>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Previous match"
        title="Previous match (Shift+Enter)"
        onClick={() => find(text, false)}
      >
        <ArrowUp size={14} />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Next match"
        title="Next match (Enter)"
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
