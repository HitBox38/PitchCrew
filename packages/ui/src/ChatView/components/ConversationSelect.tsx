import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select/index.tsx';
export function ConversationSelect({
  label,
  id,
  value,
  items,
  onChange,
  disabled = false,
  compact = true,
}: {
  label: string;
  id?: string;
  value: string;
  items: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
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
        className={compact ? 'chat-context-select' : undefined}
        size={compact ? 'sm' : 'default'}
      >
        <SelectValue />
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
}
