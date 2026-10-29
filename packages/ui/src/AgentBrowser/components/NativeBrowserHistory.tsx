import { useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/index.tsx';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover/index.tsx';
import { BrowserHistoryEntries } from './BrowserHistoryEntries.tsx';
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
        render={<Button size="icon-sm" variant="ghost" aria-label="Browser history" />}
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
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          disabled={!model.history.visits.length && !model.history.closedTabs.length}
          onClick={() => {
            model.history.clearVisits();
            model.history.clearClosed();
          }}
        >
          Clear browser history
        </Button>
        {!manual ? <p className="quiet mt-2 text-xs">Take control to reopen a page.</p> : null}
      </PopoverContent>
    </Popover>
  );
};
