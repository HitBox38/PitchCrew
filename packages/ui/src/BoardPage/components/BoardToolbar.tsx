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
    <div className="board-toolbar">
      <div className="view-switch">
        <Button className={!showClosed ? 'active' : ''} onClick={() => setShowClosed(false)}>
          Pipeline
        </Button>
        <Button className={showClosed ? 'active' : ''} onClick={() => setShowClosed(true)}>
          Closed <span>{data.cards.length - active.length}</span>
        </Button>
      </div>
      <div className="search-input">
        <Search size={15} />
        <Input
          aria-label="Search jobs"
          placeholder="Filter by company, title, tag"
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
