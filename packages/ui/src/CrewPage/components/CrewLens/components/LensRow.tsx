import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { ResponsiveDisclosure } from '@/components/ResponsiveDisclosure/index.tsx';
import { isLensGroup, type LensRow as Row } from '@/lib/crew-lens.ts';
import { LensEntry } from './LensEntry.tsx';
import { LensGroup } from './LensGroup.tsx';
import { LensPebble } from './LensPebble.tsx';
import { LensSummary } from './LensSummary.tsx';

/**
 * One busy agent as a raised row: its pebble, name and runtime, then every job-owned entry. The
 * row is a lens over the jobs' own queues, never a queue of its own. Below 36rem of lens it folds
 * to one summary line that opens in place; one DOM either way, so nothing remounts on a resize.
 */
export const LensRow = ({ row, narrow }: { row: Row; narrow: boolean }) => {
  // Not built from the role id: a custom agent's id may match another id on the page.
  const name = useId();
  return (
    <article
      className="crew-lens-row"
      data-agent={row.roleId}
      data-folds={narrow ? '' : undefined}
      aria-labelledby={name}
    >
      <div className="crew-lens-identity">
        <LensPebble row={row} />
        <div className="crew-lens-identity-text">
          <h3 id={name} className="crew-lens-name">
            {row.name}
          </h3>
          <p className="crew-lens-meta">{row.meta}</p>
        </div>
      </div>
      <ResponsiveDisclosure
        collapsible={narrow}
        className="crew-lens-disclosure"
        triggerClassName="crew-lens-trigger"
        panelClassName="crew-lens-panel"
        trigger={
          <>
            <LensPebble row={row} small />
            <LensSummary row={row} />
            <ChevronDown size={16} className="crew-lens-chevron" aria-hidden="true" />
          </>
        }
      >
        <ul className="crew-lens-entries" aria-label={`${row.name}’s work`}>
          {row.items.map((item) =>
            isLensGroup(item) ? (
              <LensGroup key={item.key} group={item} agent={row.name} />
            ) : (
              <LensEntry key={item.key} entry={item} agent={row.name} />
            ),
          )}
        </ul>
      </ResponsiveDisclosure>
    </article>
  );
};
