import { z } from 'zod';
import { reasoningLevels } from './reasoning.ts';
import type { RuntimeModel, RuntimeModelCatalog } from './runtime.ts';

const modelSelector = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(
    (value) =>
      !value.startsWith('-') &&
      !/\s/.test(value) &&
      [...value].every(
        (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
      ),
    'Use a model selector without spaces, control characters or command options.',
  );
const uniqueSelectors = (limit: number) =>
  z
    .array(modelSelector)
    .max(limit)
    .refine((items) => new Set(items).size === items.length, 'Model selectors must be unique.');
const customModel = z
  .object({
    value: modelSelector,
    label: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine(
        (value) =>
          [...value].every(
            (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
          ),
        'Use a display name without control characters.',
      ),
    reasoning: z
      .object({
        levels: z
          .array(z.enum(reasoningLevels))
          .min(1)
          .max(reasoningLevels.length)
          .refine((levels) => new Set(levels).size === levels.length),
        default: z.enum(reasoningLevels).optional(),
      })
      .strict()
      .refine(
        (value) => !value.default || value.levels.includes(value.default),
        'The default must be one of the supported reasoning levels.',
      )
      .optional(),
  })
  .strict();
export const runtimeModelPreferencesSchema = z
  .object({
    favorite: uniqueSelectors(512),
    hidden: uniqueSelectors(512),
    order: uniqueSelectors(5064),
    custom: z
      .array(customModel)
      .max(64)
      .refine(
        (models) => new Set(models.map((model) => model.value)).size === models.length,
        'Custom model selectors must be unique.',
      ),
  })
  .strict();
export type RuntimeModelPreferences = z.infer<typeof runtimeModelPreferencesSchema>;
export interface ManagedRuntimeModel extends RuntimeModel {
  custom?: true;
}
export interface RuntimeModelPreferencesState {
  preferences: RuntimeModelPreferences;
  revision: string;
  catalog: RuntimeModelCatalog;
  readError?: { code: 'unreadable'; message: string };
}
export {
  defaultRuntimeModelPreferences,
  preferredRuntimeModels,
} from './runtime-model-preferences-helpers.ts';
