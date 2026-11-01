import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { Decision } from '@/ClayInterface/signals.ts';

type DecisionPagerProps = {
  items: Decision[];
  index: number;
  select: (id: string) => void;
};

/** Position among waiting decisions; pips are decorative and capped at five. */
export const DecisionPager = ({ items, index, select }: DecisionPagerProps) => {
  const step = (by: number) => {
    const next = items[(index + by + items.length) % items.length];
    if (next) select(next.id);
  };
  const first = Math.min(Math.max(0, index - 2), Math.max(0, items.length - 5));
  return (
    <div className="decide-pager">
      <span className="decide-position">
        {index + 1} of {items.length}
      </span>
      <span className="decide-pips" aria-hidden="true">
        {items.slice(first, first + 5).map((item, position) => (
          <i key={item.id} data-current={first + position === index ? '' : undefined} />
        ))}
      </span>
      {items.length > 1 ? (
        <>
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
        </>
      ) : null}
    </div>
  );
};
