import type { Card, Snapshot } from '@pitchcrew/core';
import { dropStages } from '@/board-stages.ts';
import { groupCount } from '../helpers.ts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pitchcrew/design-system/select';

/**
 * Phones show one stage at a time; this 44px select picks it and names it with the column's own
 * count ("Leads · 42", "Leads · 6 of 42" while searching), so the column heading under it is
 * left to screen readers there (styles/board.css). Hidden on wider screens.
 */
export const BoardStageSelect = ({
  data,
  filtered,
  query,
  current,
  select,
}: {
  data: Snapshot;
  filtered: Card[];
  query: string;
  current: string;
  select: (stage: string) => void;
}) => {
  const items = dropStages.map((stage) => {
    const inStage = (card: Card) => stage.states.includes(card.state);
    const count = groupCount(
      filtered.filter(inStage).length,
      data.cards.filter(inStage).length,
      query,
    );
    return { value: stage.id, label: `${stage.label} · ${count}` };
  });
  return (
    <div className="board-stage-select">
      <Select
        value={current}
        items={items}
        onValueChange={(next) => {
          if (next !== null) select(next);
        }}
      >
        <SelectTrigger aria-label="Board stage" className="board-stage-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start" sideOffset={6}>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
