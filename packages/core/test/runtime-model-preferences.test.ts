import { describe, expect, it } from 'vitest';
import {
  defaultRuntimeModelPreferences,
  preferredRuntimeModels,
  runtimeModelPreferencesSchema,
  type RuntimeModelCatalog,
} from '../src/index.ts';
import { customModelProblem } from '../src/runtime-model-preferences-helpers.ts';

const catalog: RuntimeModelCatalog = {
  modelSource: 'runtime',
  modelDetail: 'Fixture catalog',
  models: [
    { value: 'first', label: 'First', reasoning: { levels: ['low', 'high'], default: 'low' } },
    { value: 'second', label: 'Second' },
    { value: 'third', label: 'Third' },
  ],
};
describe('workspace model preferences', () => {
  it('keeps favorites first, explicit order and selected hidden model reasoning', () => {
    const preferences = {
      ...defaultRuntimeModelPreferences(),
      favorite: ['third'],
      hidden: ['first'],
      order: ['second', 'third', 'first'],
    };
    expect(preferredRuntimeModels(catalog, preferences).map((model) => model.value)).toEqual([
      'third',
      'second',
    ]);
    expect(
      preferredRuntimeModels(catalog, preferences, { selected: 'first' }).find(
        (model) => model.value === 'first',
      )?.reasoning,
    ).toEqual({ levels: ['low', 'high'], default: 'low' });
    expect(preferredRuntimeModels(catalog, preferences, { includeHidden: true })).toHaveLength(3);
  });
  it('marks custom definitions unverified, prevents native replacement and leaves discovery untouched', () => {
    const preferences = {
      ...defaultRuntimeModelPreferences(),
      custom: [
        { value: 'custom/model', label: 'Custom' },
        { value: 'first', label: 'Override' },
      ],
    };
    const models = preferredRuntimeModels(catalog, preferences);
    expect(models.find((model) => model.value === 'first')?.label).toBe('First');
    expect(models.find((model) => model.value === 'custom/model')).toMatchObject({
      custom: true,
      label: 'Custom',
    });
    expect(catalog.models).toHaveLength(3);
    expect(preferredRuntimeModels({ ...catalog, models }, preferences)).toHaveLength(4);
  });
  it('rejects duplicate, oversized, option-like and unsupported definitions', () => {
    const preferences = defaultRuntimeModelPreferences();
    expect(
      runtimeModelPreferencesSchema.safeParse({ ...preferences, favorite: ['first', 'first'] })
        .success,
    ).toBe(false);
    for (const value of ['--config', 'bad model', 'a'.repeat(101)])
      expect(
        runtimeModelPreferencesSchema.safeParse({
          ...preferences,
          custom: [{ value, label: 'Custom' }],
        }).success,
      ).toBe(false);
    expect(
      runtimeModelPreferencesSchema.safeParse({
        ...preferences,
        custom: [
          { value: 'custom', label: 'Custom', reasoning: { levels: ['high'], default: 'low' } },
        ],
      }).success,
    ).toBe(false);
    expect(
      runtimeModelPreferencesSchema.safeParse({
        ...preferences,
        custom: [{ value: 'custom', label: 'Custom', reasoning: { levels: ['invented'] } }],
      }).success,
    ).toBe(false);
    expect(customModelProblem({ value: 'bad model', label: 'Custom' })).not.toBe('');
  });
});
