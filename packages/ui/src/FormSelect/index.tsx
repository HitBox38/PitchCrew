import { useId } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select/index.tsx';

export function FormSelect<T extends string>({
  label,
  value,
  onValueChange,
  options,
  id: suppliedId,
  disabled,
  className,
}: {
  label: string;
  value: T;
  onValueChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <div className={`field ${className ?? ''}`}>
      <label htmlFor={id}>{label}</label>
      <Select
        value={value}
        items={options}
        disabled={disabled}
        onValueChange={(next) => {
          if (next !== null) onValueChange(next);
        }}
      >
        <SelectTrigger id={id} aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start" sideOffset={6}>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
