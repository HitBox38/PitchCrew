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

/** Scoped search and the existing event-type filter, in the page title row. */
export const ActivityFilters = ({ query, kind, change }: Props) => (
  <>
    <label className="activity-search">
      <Search size={15} aria-hidden="true" />
      <Input
        type="search"
        aria-label="Search activity"
        placeholder="Search activity"
        value={query}
        onChange={(e) => change(e.target.value, kind)}
      />
      {query ? (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Clear activity search"
          onClick={() => change('', kind)}
        >
          <X size={14} />
        </Button>
      ) : null}
    </label>
    <Select items={items} value={kind} onValueChange={(value) => change(query, value ?? 'all')}>
      <SelectTrigger className="activity-kind-filter" aria-label="Activity type">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="end">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </>
);

type Props = {
  query: string;
  kind: string;
  change: (query: string, kind: string) => void;
};
const items = [
  { value: 'all', label: 'All activity' },
  ...Object.entries(eventKindLabels).map(([value, label]) => ({ value, label })),
];
