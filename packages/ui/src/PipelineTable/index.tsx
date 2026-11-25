import { useRef } from 'react';
import { useIsMobile } from '@pitchcrew/design-system/use-mobile';
import { useBulkFit } from './hooks/useBulkFit.ts';
import { usePipelineTable } from './hooks/usePipelineTable.ts';
import { useTableKeys } from './hooks/useTableKeys.ts';
import { useTableTray } from './hooks/useTableTray.ts';
import type { PipelineTableProps } from './types.ts';
import { BulkResult } from './components/BulkResult.tsx';
import { JobTable } from './components/JobTable.tsx';
import { SavedViews } from './components/SavedViews.tsx';
import { SelectionBar } from './components/SelectionBar.tsx';
import { TableHints } from './components/TableHints.tsx';

/**
 * Pipeline's Table mode: one row per job in a recessed tray that ends at its last row and scrolls
 * on its own, saved views above it, the selection bar docked under it and the keys and pager at
 * its foot. A row opens job details; its Queue cell links to Home's item or to the running
 * conversation and decides nothing. Phones get the same rows as two-line items.
 */
export const PipelineTable = (props: PipelineTableProps) => {
  const model = usePipelineTable(props);
  const bulk = useBulkFit(model);
  const {
    scroller,
    ref: trayRef,
    above,
    below,
    go,
    dismiss,
  } = useTableTray(model.setPage, bulk.dismiss);
  const region = useRef<HTMLElement | null>(null);
  const keys = useTableKeys(model, scroller, region, props.openCard);
  const phone = useIsMobile();
  return (
    <section
      ref={region}
      className="pipeline-table-view"
      aria-label="Pipeline table"
      data-selecting={model.selected.length ? '' : undefined}
    >
      {model.closed ? null : <SavedViews model={model} choose={props.chooseView} phone={phone} />}
      {bulk.report ? <BulkResult report={bulk.report} dismiss={dismiss} /> : null}
      <div
        ref={trayRef}
        className="pipeline-table-tray"
        data-table-tray=""
        data-phone={phone ? '' : undefined}
        data-more-above={above ? '' : undefined}
        data-more-below={below ? '' : undefined}
      >
        <JobTable model={model} phone={phone} open={keys.open} />
      </div>
      <SelectionBar model={model} bulk={bulk} />
      <TableHints model={model} go={go} />
    </section>
  );
};
