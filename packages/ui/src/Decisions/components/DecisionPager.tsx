import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button/index.tsx';
import type { Decision } from '@/ClayInterface/signals.ts';

type DecisionPagerProps = {
  items: Decision[];
  index: number;
  select: (id: string) => void;
};

export const DecisionPager = ({ items, index, select }: DecisionPagerProps) => {
  const step = (by: number) => {
    const next = items[(index + by + items.length) % items.length];
    if (next) select(next.id);
  };
  return (
    <div className="clay-decide-pager">
      <span className="clay-pips" aria-hidden="true">
        {items.slice(0, 8).map((item, position) => (
          <i key={item.id} data-current={position === index ? '' : undefined} />
        ))}
      </span>
      <span className="clay-decide-position">
        {index + 1} of {items.length}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous decision"
        onClick={() => step(-1)}
      >
        <ChevronLeft size={16} />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Next decision" onClick={() => step(1)}>
        <ChevronRight size={16} />
      </Button>
    </div>
  );
};
