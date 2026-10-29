import { Button } from '@/components/ui/button/components/Button.tsx';
import type { BrowserHistoryEntry } from '../history.ts';

export const BrowserHistoryEntries = ({
  title,
  entries,
  disabled,
  open,
}: {
  title: string;
  entries: BrowserHistoryEntry[];
  disabled: boolean;
  open: (url: string) => void;
}) => (
  <section aria-label={title} className="browser-history-section">
    <h4 className="quiet px-2 py-1 text-xs font-semibold">{title}</h4>
    {entries.length ? (
      entries.map((entry) => (
        <Button
          key={entry.url}
          variant="ghost"
          className="browser-history-entry"
          disabled={disabled}
          title={entry.url}
          onClick={() => open(entry.url)}
        >
          <span className="truncate">{entry.title || entry.url}</span>
          <span className="quiet truncate text-xs">{entry.url}</span>
        </Button>
      ))
    ) : (
      <p className="quiet px-2 py-1 text-xs">No pages yet.</p>
    )}
  </section>
);
