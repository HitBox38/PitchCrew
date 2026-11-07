import type { RuntimeModelCatalog } from './runtime.ts';
import type { ManagedRuntimeModel, RuntimeModelPreferences } from './runtime-model-preferences.ts';
import { reasoningLevels } from './reasoning.ts';

export const defaultRuntimeModelPreferences = (): RuntimeModelPreferences => ({
  favorite: [],
  hidden: [],
  order: [],
  custom: [],
});

/** Native discovery stays raw; custom definitions remain explicitly unverified. */
export const preferredRuntimeModels = (
  catalog: RuntimeModelCatalog,
  preferences: RuntimeModelPreferences,
  options: { includeHidden?: boolean; selected?: string } = {},
): ManagedRuntimeModel[] => {
  const native = catalog.models.filter((model) => !(model as ManagedRuntimeModel).custom);
  const values = new Set(native.map((model) => model.value));
  const models: ManagedRuntimeModel[] = [
    ...native,
    ...preferences.custom
      .filter((model) => !values.has(model.value))
      .map((model) => ({ ...model, custom: true as const })),
  ];
  const favorite = new Set(preferences.favorite);
  const hidden = new Set(preferences.hidden);
  const order = new Map(preferences.order.map((value, index) => [value, index]));
  return models
    .map((model, index) => ({ model, index }))
    .filter(
      ({ model }) =>
        options.includeHidden || !hidden.has(model.value) || model.value === options.selected,
    )
    .sort(
      (left, right) =>
        Number(favorite.has(right.model.value)) - Number(favorite.has(left.model.value)) ||
        (order.get(left.model.value) ?? 5064 + left.index) -
          (order.get(right.model.value) ?? 5064 + right.index),
    )
    .map(({ model }) => model);
};

export const customModelProblem = (model: {
  value: string;
  label: string;
  reasoning?: { levels: readonly string[]; default?: string };
}): string => {
  if (
    !model.value ||
    model.value.length > 100 ||
    model.value.startsWith('-') ||
    /\s/.test(model.value) ||
    [...model.value].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return 'Use a model selector of up to 100 characters, without spaces or command options.';
  if (
    !model.label.trim() ||
    model.label.length > 100 ||
    [...model.label].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return 'Use a display name of up to 100 characters without control characters.';
  if (
    model.reasoning &&
    (model.reasoning.levels.some(
      (level) => !reasoningLevels.includes(level as (typeof reasoningLevels)[number]),
    ) ||
      !model.reasoning.levels.length ||
      new Set(model.reasoning.levels).size !== model.reasoning.levels.length ||
      (model.reasoning.default && !model.reasoning.levels.includes(model.reasoning.default)))
  )
    return 'Choose supported reasoning levels and a default from those levels.';
  return '';
};
