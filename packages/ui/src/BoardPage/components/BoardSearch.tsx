import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Search, X } from 'lucide-react';

/** Searches every job before columns sort and page; it never opens the command palette. */
export const BoardSearch = ({
  query,
  setQuery,
}: {
  query: string;
  setQuery: (query: string) => void;
}) => (
  <div className="search-input board-search">
    <Search size={15} aria-hidden="true" />
    <Input
      aria-label="Search jobs"
      placeholder="Search jobs"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && query) {
          event.stopPropagation();
          setQuery('');
        }
      }}
    />
    {query ? (
      <Button variant="ghost" size="icon-xs" onClick={() => setQuery('')} aria-label="Clear search">
        <X size={14} />
      </Button>
    ) : null}
  </div>
);
