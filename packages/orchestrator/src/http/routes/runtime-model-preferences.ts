import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  defaultRuntimeModelPreferences,
  runtimeIds,
  runtimeModelPreferencesSchema,
} from '@pitchcrew/core';
import type { CrewService } from '../../service.ts';
import type { IdRoute } from '../types.ts';
import {
  RuntimeModelPreferencesStore,
  RuntimeModelPreferencesReadError,
} from '../../runtime-model-preferences/store.ts';
import { assertCustomModelsUnused } from '../../runtime-model-preferences/usage.ts';
import { runtimeModelsWithCustomDefinitions } from '../../runtime-model-preferences/index.ts';

/** User session only. Model choices never grant capabilities or rewrite agents. */
export const registerRuntimeModelPreferenceRoutes = (
  app: FastifyInstance,
  service: CrewService,
) => {
  const store = new RuntimeModelPreferencesStore(service.directory);
  const runtime = (id: string) => {
    const value = z.enum(runtimeIds).parse(id);
    if (value === 'demo' || !service.runtimes.some((entry) => entry.id === value))
      throw new Error('This runtime has no model preferences.');
    return value;
  };
  app.get<IdRoute>('/api/runtimes/:id/model-preferences', (req, res) => {
    res.header('Cache-Control', 'no-store');
    const id = runtime(req.params.id);
    // Focus reads never launch native discovery. Opening or refreshing a model list
    // uses the explicit POST /models path; this read uses the latest known catalog.
    const { models, modelSource, modelDetail } = service.runtimes.find((entry) => entry.id === id)!;
    const catalog = runtimeModelsWithCustomDefinitions(service.directory, id, {
      models,
      modelSource,
      modelDetail,
    });
    try {
      return { ...store.current(id), catalog };
    } catch (error) {
      if (!(error instanceof RuntimeModelPreferencesReadError)) throw error;
      return {
        preferences: defaultRuntimeModelPreferences(),
        revision: '',
        catalog,
        readError: { code: 'unreadable', message: error.message },
      };
    }
  });
  app.put<IdRoute>('/api/runtimes/:id/model-preferences', (req, res) => {
    res.header('Cache-Control', 'no-store');
    const id = runtime(req.params.id);
    const { preferences, revision } = z
      .object({
        preferences: runtimeModelPreferencesSchema,
        revision: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict()
      .parse(req.body);
    if (store.current(id).revision !== revision)
      return res.code(409).send({
        error:
          'Model choices changed in another window. Your draft is kept; review the latest choices and save again.',
      });
    // Only adapters with an explicit reasoning argument can honor custom metadata.
    if (
      !['codex', 'claude-code', 'opencode', 'copilot-cli', 'pi', 'oh-my-pi'].includes(id) &&
      preferences.custom.some((model) => model.reasoning)
    )
      throw new Error('This runtime does not support custom reasoning controls.');
    assertCustomModelsUnused(service.board, id, store.current(id).preferences, preferences);
    return store.save(id, preferences, revision);
  });
  app.post<IdRoute>('/api/runtimes/:id/model-preferences/reset', (req, res) => {
    runtime(req.params.id);
    z.object({ confirmed: z.literal(true) })
      .strict()
      .parse(req.body);
    res.header('Cache-Control', 'no-store');
    return store.resetUnreadable();
  });
};
