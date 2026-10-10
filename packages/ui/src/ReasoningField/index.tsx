import type { ModelReasoning } from '@pitchcrew/core';
import { Select } from '@/components/ui/select/constants.ts';
import { SelectContent } from '@/components/ui/select/components/SelectContent.tsx';
import { SelectItem } from '@/components/ui/select/components/SelectItem.tsx';
import { SelectTrigger } from '@/components/ui/select/components/SelectTrigger.tsx';
import { SelectValue } from '@/components/ui/select/components/SelectValue.tsx';
import { reasoningLabels } from '@/lib/reasoning.ts';

interface ReasoningFieldProps {
  id: string;
  reasoning?: ModelReasoning;
  value: string;
  onValueChange(value: string): void;
  disabled?: boolean;
  compact?: boolean;
  agentDefault?: string;
  conversation?: boolean;
}

export function ReasoningField({
  id,
  reasoning,
  value,
  onValueChange,
  disabled,
  compact,
  agentDefault,
  conversation,
}: ReasoningFieldProps) {
  if (!reasoning?.levels.length && !agentDefault) return null;
  const items = [
    ...(agentDefault ? [{ value: 'agent', label: agentDefault }] : []),
    {
      value: '',
      label: reasoning?.default
        ? `CLI default (${reasoningLabels[reasoning.default]})`
        : 'CLI default',
    },
    ...(reasoning?.levels ?? []).map((level) => ({ value: level, label: reasoningLabels[level] })),
  ];
  return (
    <div className={compact ? 'flex items-center gap-2' : 'field'}>
      <label htmlFor={id} className={compact ? 'quiet text-xs' : undefined}>
        {compact || conversation ? 'Reasoning' : 'Default reasoning'}
      </label>
      <Select
        value={value}
        items={items}
        disabled={disabled}
        onValueChange={(next) => {
          if (next !== null) onValueChange(next);
        }}
      >
        <SelectTrigger id={id} className={compact ? 'w-auto min-w-28' : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} sideOffset={6}>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!compact ? (
        <span className="optional">
          {conversation
            ? 'Applies to this participant in this conversation.'
            : 'Used for this agent’s work. You can override it in chat.'}
        </span>
      ) : null}
    </div>
  );
}
