import { Globe } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { recentPageRows } from '../clay-states.ts';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';

/** Under the empty page: this conversation's closed tabs, or else recently visited pages. */
export const ClayRecentPages = ({
  model,
  manual,
}: {
  model: NativeBrowserModel;
  manual: boolean;
}) => {
  const closed = model.history.closedTabs.length > 0;
  const rows = recentPageRows(closed ? model.history.closedTabs : model.history.visits);
  if (!rows.length) return null;
  const heading = closed ? 'Recently closed' : 'Recently visited';
  return (
    <section className="clay-recent-pages" aria-label={heading}>
      <h4>{heading}</h4>
      {rows.map((row) => (
        <Button
          key={row.url}
          variant="ghost"
          className="clay-recent-page"
          disabled={!manual}
          title={row.url}
          onClick={() =>
            void model.navigate(row.url, closed).then((succeeded) => {
              if (succeeded && closed) model.history.forgetClosed(row.url);
            })
          }
        >
          <Globe size={14} aria-hidden="true" />
          <strong>{row.host}</strong>
          <span>{row.title}</span>
          <time>{row.when}</time>
        </Button>
      ))}
      {!manual ? <p>Take control to reopen a page.</p> : null}
    </section>
  );
};
