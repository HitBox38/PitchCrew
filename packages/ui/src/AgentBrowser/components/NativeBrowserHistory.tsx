import { useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { Input } from '@pitchcrew/design-system/input';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@pitchcrew/design-system/popover';
import { BrowserHistoryEntries } from './BrowserHistoryEntries.tsx';
import { BrowserHistoryClear } from './BrowserHistoryClear.tsx';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';

export const NativeBrowserHistory = ({
  model,
  manual,
}: {
  model: NativeBrowserModel;
  manual: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const empty = !model.history.visits.length && !model.history.closedTabs.length;
  const clear = () => {
    model.history.clearVisits();
    model.history.clearClosed();
  };
  const search = query.trim().toLowerCase();
  const filter = (entry: { url: string; title: string }) =>
    `${entry.title} ${entry.url}`.toLowerCase().includes(search);
  const navigate = (url: string, newTab = false) => {
    setOpen(false);
    void model.navigate(url, newTab).then((succeeded) => {
      if (succeeded && newTab) model.history.forgetClosed(url);
    });
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button size="icon-sm" variant="ghost" aria-label="Browser history" title="History" />
        }
      >
        <History size={15} />
      </PopoverTrigger>
      <PopoverContent className="browser-history-popover w-80 max-w-[calc(100vw-2rem)] p-3">
        <PopoverTitle>Browser history</PopoverTitle>
        <Input
          className="my-2"
          aria-label="Search browser history"
          placeholder="Find a page…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="browser-history-list">
          <BrowserHistoryEntries
            title="Recently closed in this conversation"
            entries={model.history.closedTabs.filter(filter)}
            disabled={!manual}
            open={(url) => navigate(url, true)}
          />
          <BrowserHistoryEntries
            title="Recently visited in this profile"
            entries={model.history.visits.filter(filter)}
            disabled={!manual}
            open={navigate}
          />
        </div>
        {empty ? <p className="browser-history-empty">No pages yet.</p> : null}
        {!empty ? <BrowserHistoryClear clear={clear} /> : null}
        {!manual ? <p className="quiet mt-2 text-xs">Take control to reopen a page.</p> : null}
      </PopoverContent>
    </Popover>
  );
};
