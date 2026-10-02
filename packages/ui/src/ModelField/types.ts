import type { useModelField } from '@/ModelField/hooks/useModelField.ts';
import type { RuntimeId, RuntimeModel, RuntimeModelCatalog } from '@pitchcrew/core';

export interface ModelFieldProps {
  id: string;
  runtime: RuntimeId;
  available: boolean;
  initialCatalog: RuntimeModelCatalog;
  value: string;
  onValueChange: (value: string) => void;
}

export interface ModelPickerProps {
  id: string;
  models: readonly RuntimeModel[];
  value: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
}
export type ModelFieldModel = NonNullable<ReturnType<typeof useModelField>>;
