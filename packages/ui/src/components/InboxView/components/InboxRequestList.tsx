import { useLayoutEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { EmptyState } from '@/components/EmptyState/index.tsx';
import { InboxRow } from './InboxRow.tsx';
import { readInboxPreference, saveInboxPreference } from '../hooks/preferences.ts';
import type { InboxViewModel } from '../types.ts';
export const InboxRequestList = (model: InboxViewModel) => {
  const scroll = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = readInboxPreference('scroll', 0);
    const last = readInboxPreference<string>('last-row', '');
    scroll.current
      ?.querySelector<HTMLButtonElement>(`[data-request-key="${CSS.escape(last)}"]`)
      ?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="mailbox">
      <div className="mailbox-toolbar">
        <label className="inbox-search">
          <Search size={16} />
          <span className="sr-only">Search inbox</span>
          <Input
            placeholder="Search agent, job or filename…"
            value={model.search}
            onChange={(event) => model.setSearch(event.target.value)}
          />
        </label>
        <fieldset className="mailbox-filters" aria-label="Request type">
          {(['all', 'packet', 'browser'] as const).map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant="ghost"
              aria-pressed={filter === model.filter}
              onClick={() => model.setFilter(filter)}
            >
              {filter === 'all' ? 'All' : filter === 'packet' ? 'Packets' : 'Browser'}
            </Button>
          ))}
        </fieldset>
        <Button
          size="sm"
          variant="outline"
          aria-pressed={model.unreadOnly}
          onClick={() => model.setUnreadOnly(!model.unreadOnly)}
        >
          Unread
        </Button>
      </div>
      <div className="mailbox-caption">
        <span>{model.tab === 'pending' ? 'Decisions and next steps' : 'Your saved decisions'}</span>
        <span>{model.requests.length} requests</span>
      </div>
      <div
        className="mailbox-rows"
        ref={scroll}
        onScroll={() => saveInboxPreference('scroll', scroll.current?.scrollTop ?? 0)}
      >
        {model.requests.length ? (
          model.requests.map((request) => (
            <InboxRow key={request.key} request={request} model={model} />
          ))
        ) : (
          <EmptyState
            title={
              model.search || model.unreadOnly
                ? 'No matching requests'
                : model.tab === 'pending'
                  ? 'You’re all caught up'
                  : 'No history yet'
            }
            description="Packet reviews, browser decisions and application follow-ups appear here."
          />
        )}
      </div>
    </div>
  );
};
