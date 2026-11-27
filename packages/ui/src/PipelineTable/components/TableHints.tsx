import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { Kbd } from '@pitchcrew/design-system/kbd';
import { keyHints } from '../constants.ts';
import type { TableModel } from '../hooks/usePipelineTable.ts';

/**
 * The quiet foot under the tray: the table's keys on the left (hidden where there is no keyboard),
 * and the page range with Previous and Next, always shown, on the right. The range is announced.
 */
export const TableHints = ({ model, go }: { model: TableModel; go: (page: number) => void }) => (
  <div className="pipeline-table-foot">
    <ul className="pipeline-table-keys" aria-label="Keyboard shortcuts">
      {keyHints
        .filter((hint) => model.selectable || !hint.select)
        .map((hint) => (
          <li key={hint.label}>
            {hint.keys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
            {hint.label}
          </li>
        ))}
    </ul>
    <nav className="pipeline-table-pager" aria-label="Table pages">
      <output aria-live="polite">{model.range}</output>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous page"
        disabled={model.page === 0}
        onClick={() => go(model.page - 1)}
      >
        <ChevronLeft size={16} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next page"
        disabled={model.page >= model.pages - 1}
        onClick={() => go(model.page + 1)}
      >
        <ChevronRight size={16} />
      </Button>
    </nav>
  </div>
);
