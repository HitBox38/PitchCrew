import { Button } from '@pitchcrew/design-system/button';
import type { BrowserHistoryEntry } from '../history.ts';
import { addressParts } from '../helpers.ts';

/** A history section; hidden when empty. Rows show the title, then host and path. */
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
}) =>
  entries.length ? (
    <section aria-label={title} className="browser-history-section">
      <h4 className="browser-history-heading">{title}</h4>
      {entries.map((entry) => {
        const parts = addressParts(entry.url);
        const where = parts ? `${parts.host.replace(/^www\./, '')}${parts.rest}` : entry.url;
        return (
          <Button
            key={entry.url}
            variant="ghost"
            className="browser-history-entry"
            disabled={disabled}
            title={entry.url}
            onClick={() => open(entry.url)}
          >
            <span className="browser-history-title truncate">{entry.title || where}</span>
            <span className="browser-history-where truncate">{where}</span>
          </Button>
        );
      })}
    </section>
  ) : null;
