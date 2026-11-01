import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input/index.tsx';
import type { Ref } from 'react';

/** Find chats: searches titles, participants and the full saved message history. */
export const ConversationSearch = ({
  query,
  setQuery,
  error,
  inputRef,
  close,
}: {
  query: string;
  setQuery: (query: string) => void;
  error: string;
  inputRef: Ref<HTMLInputElement>;
  close: () => void;
}) => (
  <>
    <div className="conversation-search">
      <Search size={13} aria-hidden="true" />
      <Input
        ref={inputRef}
        aria-label="Search conversations and messages"
        placeholder="Find chats"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          close();
        }}
      />
    </div>
    {error ? (
      <p role="alert" className="quiet px-2">
        {error}
      </p>
    ) : null}
  </>
);
