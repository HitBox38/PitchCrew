import { useState } from 'react';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { AccordionSection } from '@/components/ui/accordion/index.tsx';
import { Input } from '@/components/ui/input/index.tsx';
import { Checkbox } from '@/components/ui/checkbox/index.tsx';

export const PlanJobPicker = ({
  selected,
  change,
}: {
  selected: string[];
  change: (ids: string[]) => void;
}) => {
  const cards = useWorkspaceStore((s) => s.data?.cards ?? []);
  const [query, setQuery] = useState('');
  const selectedIds = new Set(selected);
  const matching = cards.filter((c) =>
    `${c.company} ${c.title}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <AccordionSection heading={`Choose individual jobs (${selected.length} selected)`}>
      <div className="space-y-3">
        <Input
          aria-label="Search jobs for this plan"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {matching.slice(0, 20).map((c) => (
          <label key={c.id} className="flex items-start gap-2">
            <Checkbox
              checked={selectedIds.has(c.id)}
              disabled={!selectedIds.has(c.id) && selected.length >= 100}
              onCheckedChange={(checked) =>
                change(checked ? [...selected, c.id] : selected.filter((id) => id !== c.id))
              }
            />
            <span>
              {c.company}: {c.title}
            </span>
          </label>
        ))}
        {matching.length > 20 ? (
          <p className="quiet">
            Showing 20 of {matching.length} jobs. Refine the search to choose others.
          </p>
        ) : null}
      </div>
    </AccordionSection>
  );
};
