import { cliDefault } from '@/ModelField/constants.ts';
import type { ModelPickerProps } from '@/ModelField/types.ts';
import { Combobox } from '@base-ui/react/combobox';
import type { RuntimeModel } from '@pitchcrew/core';
import { Check, ChevronDown } from 'lucide-react';

export function ModelPicker({ id, models, value, onValueChange, disabled }: ModelPickerProps) {
  const items = [cliDefault, ...models];
  // Keep an existing CLI model visible even if it is outside the suggested catalog.
  const selected = items.find((item) => item.value === value) ?? { value, label: value };

  return (
    <Combobox.Root
      items={items}
      value={selected}
      onValueChange={(item) => onValueChange(item?.value ?? '')}
      isItemEqualToValue={(item, selectedValue) => item.value === selectedValue.value}
      filter={(item, query) =>
        `${item.label} ${item.value}`.toLowerCase().includes(query.toLowerCase())
      }
      disabled={disabled}
      autoHighlight
    >
      <div className="model-picker-input">
        <Combobox.Input id={id} placeholder="Search models…" maxLength={100} />
        <Combobox.Trigger className="model-picker-trigger" aria-label="Show models">
          <ChevronDown size={16} aria-hidden="true" />
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={6} align="start" className="z-50">
          <Combobox.Popup className="model-picker-popup">
            <Combobox.Empty className="model-picker-empty">No matching models.</Combobox.Empty>
            <Combobox.List>
              {(item: RuntimeModel) => (
                <Combobox.Item key={item.value} value={item} className="model-picker-item">
                  <span>{item.label}</span>
                  <Combobox.ItemIndicator>
                    <Check size={15} aria-hidden="true" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
