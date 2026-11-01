import type { Snapshot } from '@pitchcrew/core';
import { dropStages } from '@/board-stages.ts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pitchcrew/design-system/select';

/** Phones show one stage at a time; this 44px select picks it. Hidden on wider screens. */
export const BoardStageSelect = ({
  data,
  current,
  select,
}: {
  data: Snapshot;
  current: string;
  select: (stage: string) => void;
}) => {
  const items = dropStages.map((stage) => ({
    value: stage.id,
    label: `${stage.label} · ${data.cards.filter((card) => stage.states.includes(card.state)).length}`,
  }));
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
