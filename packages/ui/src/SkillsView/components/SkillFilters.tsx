import { Button } from '@/components/ui/button/components/Button.tsx';
import type { SkillFiltersProps } from '@/SkillsView/types.ts';

export function SkillFilters({ filters, filter, onFilter }: SkillFiltersProps) {
  return (
    <fieldset className="skill-filters" aria-label="Filter skills by agent">
      {filters.map((item) => (
        <Button
          key={item.value}
          className={`button small ${filter === item.value ? 'active' : ''}`}
          aria-pressed={filter === item.value}
          onClick={() => onFilter(item.value)}
        >
          {item.label}
        </Button>
      ))}
    </fieldset>
  );
}
