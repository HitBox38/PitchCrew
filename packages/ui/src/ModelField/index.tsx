import { Button } from '@/components/ui/button/components/Button.tsx';
import { ModelPicker } from '@/ModelField/components/ModelPicker.tsx';
import { useModelField } from '@/ModelField/hooks/useModelField.ts';
import type { ModelFieldProps } from '@/ModelField/types.ts';
import { RefreshCw } from 'lucide-react';

export function ModelField(props: ModelFieldProps) {
  const controller = useModelField(props);
  const {
    id,
    runtime,
    available,
    value,
    onValueChange,
    catalog,
    loading,
    setLoading,
    setRefresh,
    error,
    setError,
  } = controller;
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
