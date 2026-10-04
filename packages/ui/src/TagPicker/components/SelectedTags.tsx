import { Combobox } from '@base-ui/react/combobox';
import { X } from 'lucide-react';

export function SelectedTags({ value }: { value: string[] }) {
  return value.map((tag) => (
    <Combobox.Chip
      key={tag}
      className="tag-picker-chip"
      aria-label={tag}
      aria-description="Press Backspace or Delete to remove"
    >
      <span className="min-w-0 break-words">{tag}</span>
      <Combobox.ChipRemove className="tag-picker-remove" aria-label={`Remove ${tag}`}>
        <X size={12} aria-hidden="true" />
      </Combobox.ChipRemove>
    </Combobox.Chip>
  ));
}
