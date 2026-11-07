import type { ReactNode } from 'react';
import { cn } from '@pitchcrew/design-system/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pitchcrew/design-system/select';
export const ConversationSelect = ({
  label,
  id,
  value,
  items,
  onChange,
  disabled = false,
  compact = true,
  className,
  icon,
  displayValue,
  description,
}: {
  label: string;
  id?: string;
  value: string;
  items: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
  /** Extra trigger classes, such as a clay composer chip. */
  className?: string;
  /** Leading trigger icon. */
  icon?: ReactNode;
  displayValue?: ReactNode;
  description?: string;
}) => {
  return (
    <Select
      value={value}
      items={items}
      disabled={disabled}
      onValueChange={(next: string | null) => {
        if (next !== null) onChange(next);
      }}
    >
      <SelectTrigger
        id={id}
        aria-label={label}
        aria-description={description}
        title={description}
        className={cn(compact && 'chat-context-select', className) || undefined}
        size={compact ? 'sm' : 'default'}
      >
        {icon}
        <SelectValue>{displayValue}</SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
