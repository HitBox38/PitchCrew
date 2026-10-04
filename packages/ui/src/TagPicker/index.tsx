import { Combobox } from '@base-ui/react/combobox';
import { useTagPicker } from './hooks/useTagPicker.ts';
import { SelectedTags } from './components/SelectedTags.tsx';
import { TagSuggestions } from './components/TagSuggestions.tsx';
import type { TagPickerProps } from './types.ts';

export function TagPicker(props: TagPickerProps) {
  const {
    id,
    value,
    query,
    changeQuery,
    disabled,
    options,
    select,
    filteredItems,
    open,
    setOpen,
    press,
    paste,
    error,
    atLimit,
  } = useTagPicker(props);
  return (
    <div className="field">
      <label htmlFor={id}>Tags</label>
      <Combobox.Root
        multiple
        items={options.items}
        filteredItems={filteredItems}
        open={open}
        onOpenChange={setOpen}
        value={value}
        onValueChange={select}
        inputValue={query}
        onInputValueChange={changeQuery}
        disabled={disabled}
        autoHighlight
      >
        <Combobox.InputGroup className="tag-picker-group">
          <Combobox.Chips className="tag-picker-chips" aria-label="Selected tags">
            <SelectedTags value={value} />
            <Combobox.Input
              id={id}
              className="tag-picker-input"
              placeholder={
                atLimit
                  ? '10 tags selected'
                  : value.length
                    ? 'Add another tag…'
                    : 'Search or add a tag…'
              }
              maxLength={40}
              aria-describedby={`${id}-hint`}
              aria-invalid={!!error}
              onKeyDown={press}
              onPaste={paste}
            />
          </Combobox.Chips>
        </Combobox.InputGroup>
        <TagSuggestions custom={options.custom} atLimit={atLimit} />
      </Combobox.Root>
      <p id={`${id}-hint`} className="optional" aria-live="polite">
        {atLimit
          ? '10 of 10 tags. Remove a tag to add another.'
          : 'Choose a suggestion, or type a tag and press Enter or comma.'}
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
