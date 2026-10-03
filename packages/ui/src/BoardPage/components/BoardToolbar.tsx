import type { BoardToolbarProps } from '@/BoardPage/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Search, X } from 'lucide-react';

export function BoardToolbar({
  showClosed,
  setShowClosed,
  data,
  active,
  query,
  setQuery,
}: BoardToolbarProps) {
  return (
    <div className="board-toolbar mb-4.5 flex items-center gap-3.5 max-compact:flex-wrap">
      <fieldset className="view-switch" aria-label="Board view">
        <Button
          aria-pressed={!showClosed}
          className={!showClosed ? 'active' : ''}
          onClick={() => setShowClosed(false)}
        >
          Pipeline
        </Button>
        <Button
          aria-pressed={showClosed}
          className={showClosed ? 'active' : ''}
          onClick={() => setShowClosed(true)}
        >
          Closed <span>{data.cards.length - active.length}</span>
        </Button>
      </fieldset>
      <div className="search-input">
        <Search size={15} />
        <Input
          aria-label="Search jobs"
          placeholder="Search company, title, or tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query ? (
          <Button className="icon-button" onClick={() => setQuery('')} aria-label="Clear search">
            <X size={14} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
