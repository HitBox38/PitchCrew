import { Globe } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { recentPageRows } from '../clay-states.ts';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';

/** This conversation's recently closed tabs under the empty page. */
export const ClayRecentPages = ({
  model,
  manual,
}: {
  model: NativeBrowserModel;
  manual: boolean;
}) => {
  const rows = recentPageRows(model.history.closedTabs);
  if (!rows.length) return null;
  return (
    <section className="clay-recent-pages" aria-label="Recently closed">
      <h4>Recently closed</h4>
      {rows.map((row) => (
        <Button
          key={row.url}
          variant="ghost"
          className="clay-recent-page"
          disabled={!manual}
          title={row.url}
          onClick={() =>
            void model.navigate(row.url, true).then((succeeded) => {
              if (succeeded) model.history.forgetClosed(row.url);
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
