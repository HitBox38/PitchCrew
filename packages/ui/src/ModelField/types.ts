import type { useModelField } from '@/ModelField/hooks/useModelField.ts';
import type {
  ReasoningLevel,
  RuntimeId,
  RuntimeModel,
  RuntimeModelCatalog,
  Role,
} from '@pitchcrew/core';

export interface ModelFieldProps {
  id: string;
  runtime: RuntimeId;
  available: boolean;
  initialCatalog: RuntimeModelCatalog;
  reasoning: ReasoningLevel | null;
  onReasoningChange: (value: ReasoningLevel | null) => void;
  value: string;
  onValueChange: (value: string) => void;
  conversation?: boolean;
  agentDefaults?: Pick<Role, 'model' | 'reasoning'>;
  inheritModel?: boolean;
  inheritReasoning?: boolean;
  onInheritModel?: () => void;
  onInheritReasoning?: () => void;
}

export interface ModelPickerProps {
  id: string;
  models: readonly RuntimeModel[];
  value: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
  agentDefault?: RuntimeModel;
}
export type ModelFieldModel = NonNullable<ReturnType<typeof useModelField>>;
