import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pitchcrew/design-system/select';
import { Bead } from '@/ClayInterface/components/Bead.tsx';
import { viewDef, viewFacts } from '../helpers.ts';
import type { TableView, ViewCount } from '../types.ts';

type Props = {
  views: readonly TableView[];
  current: TableView;
  counts: Record<TableView, ViewCount>;
  query: string;
  choose: (view: TableView) => void;
  label: string;
  /** Shown while the current view is outside this select ("More views"). */
  placeholder?: string;
};

/**
 * Saved views folded into one select, each with its count and the bead it keys in the Queue
 * column: the views beyond Scope when the tracks would wrap, or every view on a phone. Each option
 * keeps a bead's slot, so the labels start on one edge.
 */
export const ViewSelect = ({
  views,
  current,
  counts,
  query,
  choose,
  label,
  placeholder,
}: Props) => {
  const options = views.map((id) => {
    const { count, tone } = viewFacts(viewDef(id), counts[id], query);
    return { value: id, label: `${viewDef(id).label} · ${count}`, tone };
  });
  const inside = views.includes(current);
  return (
    <Select
      value={inside ? current : null}
      items={options}
      onValueChange={(next) => {
        if (next) choose(next);
      }}
    >
      <SelectTrigger
        aria-label={label}
        className="saved-views-select"
        data-current={inside ? '' : undefined}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start" sideOffset={6}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="saved-views-option">
              <span className="saved-views-option-bead">
                {option.tone ? (
                  <Bead tone={option.tone === 'socket' ? undefined : option.tone} />
                ) : null}
              </span>
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
