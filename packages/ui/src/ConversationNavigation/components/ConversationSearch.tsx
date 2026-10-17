import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input/index.tsx';
import type { Ref } from 'react';

export function ConversationSearch({
  query,
  setQuery,
  error,
  inputRef,
}: {
  query: string;
  setQuery: (query: string) => void;
  error: string;
  inputRef: Ref<HTMLInputElement>;
}) {
  return (
    <>
      <div className="conversation-search">
        <Search size={13} />
        <Input
          ref={inputRef}
          aria-label="Search conversations and messages"
          placeholder="Search conversations"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="quiet px-2">
          {error}
        </p>
      ) : null}
    </>
  );
}
