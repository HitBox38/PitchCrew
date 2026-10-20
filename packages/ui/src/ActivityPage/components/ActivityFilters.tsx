import { eventKindLabels } from '@/ActivityPage/constants.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select/index.tsx';
import { Search, X } from 'lucide-react';
export const ActivityFilters = ({ query, kind, change, count }: Props) => {
  return (
    <div className="activity-toolbar flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-5 py-3.5 max-mobile:px-3">
      <div className="search-input">
        <Search size={15} aria-hidden="true" />
        <Input
          aria-label="Search activity"
          placeholder="Search your activity…"
          value={query}
          onChange={(e) => change(e.target.value, kind)}
        />
        {query ? (
          <Button
            className="icon-button"
            aria-label="Clear activity search"
            onClick={() => change('', kind)}
          >
            <X size={14} />
          </Button>
        ) : null}
      </div>
      <Select items={items} value={kind} onValueChange={(value) => change(query, value ?? 'all')}>
        <SelectTrigger aria-label="Activity type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <output className="subtle" aria-live="polite" aria-atomic="true">
        {count} {count === 1 ? 'event' : 'events'}
      </output>
    </div>
  );
};

type Props = {
  query: string;
  kind: string;
  change: (query: string, kind: string) => void;
  count: number;
};
const items = [
  { value: 'all', label: 'All activity' },
  ...Object.entries(eventKindLabels).map(([value, label]) => ({ value, label })),
];
