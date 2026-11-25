import { Button } from '@pitchcrew/design-system/button';
import type { BulkModel } from '../hooks/useBulkFit.ts';
import type { TableModel } from '../hooks/usePipelineTable.ts';

/**
 * Appears with a selection, docked under the tray so it never covers a row. Evaluate fit queues
 * one board action per selected job (each in its own job queue, never a batch); Add job stays the
 * page's one glaze, so these verbs are clay and flat. The count says where the selection sits,
 * since it spans pages and views.
 */
export const SelectionBar = ({ model, bulk }: { model: TableModel; bulk: BulkModel }) => {
  const { count, otherPages, notShown } = model.selection;
  if (!model.selectable || !count) return null;
  const facts = [
    otherPages ? `${otherPages} on other pages` : '',
    notShown ? `${notShown} not shown` : '',
  ].filter(Boolean);
  const jobs = `${count} ${count === 1 ? 'job' : 'jobs'}`;
  return (
    <section className="selection-bar" aria-label="Selected jobs">
      <p className="selection-bar-count">
        <strong>{count}</strong> selected
        {facts.map((fact) => ` · ${fact}`).join('')}
        <span className="selection-bar-note"> · One queued action per job</span>
        {/* Always present, so each step of a batch is announced. */}
        <output className="selection-bar-progress">
          {bulk.progress
            ? ` · Queuing ${Math.min(bulk.progress.done + 1, bulk.progress.total)} of ${bulk.progress.total}…`
            : ''}
        </output>
      </p>
      <div className="selection-bar-actions">
        <Button
          variant="outline"
          disabled={!!bulk.progress}
          onClick={bulk.evaluate}
          aria-label={`Evaluate fit for ${jobs}`}
        >
          Evaluate fit
        </Button>
        <Button variant="ghost" disabled={!!bulk.progress} onClick={model.clear}>
          Clear
        </Button>
      </div>
    </section>
  );
};
