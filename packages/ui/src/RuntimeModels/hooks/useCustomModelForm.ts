import { useEffect, useRef, useState } from 'react';
import { type ManagedRuntimeModel, type ReasoningLevel, type RuntimeModel } from '@pitchcrew/core';
import { customModelProblem } from '@pitchcrew/core/runtime-model-preferences';
import type { CustomRuntimeModel } from '../types.ts';

export const useCustomModelForm = (
  existing: RuntimeModel | null,
  models: ManagedRuntimeModel[],
  onDirtyChange?: (value: boolean) => void,
) => {
  const [value, setValue] = useState(existing?.value ?? '');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [levels, setLevels] = useState<ReasoningLevel[]>([...(existing?.reasoning?.levels ?? [])]);
  const [defaultLevel, setDefaultLevel] = useState(existing?.reasoning?.default ?? '');
  const [error, setError] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const entry = {
    value: value.trim(),
    label: label.trim() || value.trim(),
    ...(levels.length
      ? { reasoning: { levels, ...(defaultLevel ? { default: defaultLevel } : {}) } }
      : {}),
  };
  const dirty =
    value !== (existing?.value ?? '') ||
    label !== (existing?.label ?? '') ||
    JSON.stringify(levels) !== JSON.stringify(existing?.reasoning?.levels ?? []) ||
    defaultLevel !== (existing?.reasoning?.default ?? '');
  useEffect(() => {
    field.current?.focus();
  }, []);
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  const validate = (): CustomRuntimeModel | null => {
    const problem = customModelProblem(entry);
    if (problem) {
      setError(problem);
      return null;
    }
    if (models.some((model) => model.value === entry.value && model.value !== existing?.value)) {
      setError('That model selector is already listed.');
      return null;
    }
    setError('');
    return entry as CustomRuntimeModel;
  };
  return {
    value,
    setValue,
    label,
    setLabel,
    levels,
    setLevels,
    defaultLevel,
    setDefaultLevel,
    error,
    field,
    validate,
    dirty,
  };
};
