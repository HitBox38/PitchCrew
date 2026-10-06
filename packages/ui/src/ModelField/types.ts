import type { useModelField } from '@/ModelField/hooks/useModelField.ts';
import type { ReasoningLevel, RuntimeId, RuntimeModel, RuntimeModelCatalog } from '@pitchcrew/core';

export interface ModelFieldProps {
  id: string;
  runtime: RuntimeId;
  available: boolean;
  initialCatalog: RuntimeModelCatalog;
  reasoning: ReasoningLevel | null;
  onReasoningChange: (value: ReasoningLevel | null) => void;
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
