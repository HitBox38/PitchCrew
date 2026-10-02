import { Combobox } from '@base-ui/react/combobox';
import { Check, ChevronDown, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { RuntimeId, RuntimeModel, RuntimeModelCatalog } from '@pitchcrew/core';
import { api } from './api.ts';
import { Button } from './components/ui/button.tsx';

const cliDefault: RuntimeModel = { value: '', label: 'CLI default' };

export function ModelField({
  id,
  runtime,
  available,
  initialCatalog,
  value,
  onValueChange,
}: {
  id: string;
  runtime: RuntimeId;
  available: boolean;
  initialCatalog: RuntimeModelCatalog;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [loading, setLoading] = useState(runtime !== 'demo');
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    if (runtime === 'demo') return;
    const controller = new AbortController();
    void api<RuntimeModelCatalog>(
      `/runtimes/${runtime}/models`,
      'POST',
      { refresh: refresh > 0 },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setCatalog(result);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Could not refresh models. Showing the last loaded choices.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [runtime, refresh]);
  return (
    <div className="field">
      <div className="model-field-heading">
        <label htmlFor={id}>Model</label>
        {runtime !== 'demo' && (
          <Button
            size="xs"
            variant="ghost"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setError('');
              setRefresh((count) => count + 1);
            }}
          >
            <RefreshCw
              size={13}
              aria-hidden="true"
              className={loading ? 'animate-spin' : undefined}
            />
            Refresh models
          </Button>
        )}
      </div>
      <ModelPicker
        id={id}
        models={catalog.models}
        value={value}
        onValueChange={onValueChange}
        disabled={!available || runtime === 'demo'}
      />
      <output className="optional" aria-live="polite">
        {!available
          ? 'This runtime is unavailable. Choose an available runtime to save settings.'
          : loading
            ? 'Loading models from the runtime…'
            : error || catalog.modelDetail}
      </output>
      {runtime !== 'demo' && !loading && (
        <span className="optional">
          {catalog.modelSource === 'runtime' ? 'Runtime models' : 'Suggested models'} · CLI default
          uses your runtime’s default.
        </span>
      )}
    </div>
  );
}

export function ModelPicker({
  id,
  models,
  value,
  onValueChange,
  disabled,
}: {
  id: string;
  models: readonly RuntimeModel[];
  value: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
}) {
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
