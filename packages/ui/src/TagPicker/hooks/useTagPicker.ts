import { useId, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import type { Combobox } from '@base-ui/react/combobox';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { tagOptions, tagValues } from '../helpers.ts';
import type { TagPickerProps } from '../types.ts';

export function useTagPicker(props: TagPickerProps) {
  const { value, query, onValueChange, onQueryChange } = props;
  const cards = useWorkspaceStore((state) => state.data?.cards);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const id = useId();
  const options = tagOptions(cards?.flatMap((card) => card.tags) ?? [], value, query);
  const selected = new Set(value.map((tag) => tag.toLowerCase()));
  const atLimit = value.length >= 10;
  const filteredItems = options.items.filter(
    (tag) =>
      !selected.has(tag.toLowerCase()) && tag.toLowerCase().includes(query.trim().toLowerCase()),
  );
  function changeQuery(next: string, details: Combobox.Root.ChangeEventDetails) {
    // Closing suggestions must not discard an unfinished tag before the form saves it.
    if (details.reason === 'input-clear' && !details.isItemPress) {
      details.cancel();
      return;
    }
    onQueryChange(next);
  }
  function select(tags: string[]) {
    setOpen(false);
    try {
      onValueChange(tagValues(tags));
      if (tags.length >= value.length) onQueryChange('');
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add tags.');
    }
  }
  function press(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (
      event.key === ',' ||
      (event.key === 'Enter' && (atLimit || selected.has(query.trim().toLowerCase())))
    ) {
      event.preventDefault();
      if (query.trim()) select([...value, ...query.split(',')]);
    }
  }
  function paste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text');
    if (!text.includes(',')) return;
    event.preventDefault();
    const input = event.currentTarget;
    const inserted =
      query.slice(0, input.selectionStart ?? query.length) +
      text +
      query.slice(input.selectionEnd ?? query.length);
    select([...value, ...inserted.split(',')]);
  }
  return {
    ...props,
    id,
    error,
    atLimit,
    open,
    setOpen,
    filteredItems,
    changeQuery,
    options,
    select,
    press,
    paste,
  };
}
