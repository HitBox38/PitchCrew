import { adapters, discoverModels, suggestedModels } from '@pitchcrew/adapters';
import { type RuntimeId, type RuntimeInfo, type RuntimeModelCatalog } from '@pitchcrew/core';
import type { CrewContext } from './types.ts';

export const detect = async (context: CrewContext): Promise<RuntimeInfo[]> => {
  context.runtimes = await Promise.all(
    Object.values(adapters)
      .filter((adapter) => context.dev || adapter.id !== 'demo')
      .map(async (adapter) => {
        if (context.runtimeMaintenance.isUpdating(adapter.id))
          return context.runtimes.find((entry) => entry.id === adapter.id)!;
        const health = await context.runtimeMaintenance.metadata(adapter.id, () =>
          adapter.detect(),
        );
        const cached = context.modelCatalogs.get(adapter.id);
        return {
          ...health,
          ...(health.available && cached && cached.expiresAt > Date.now()
            ? cached.catalog
            : suggestedModels(adapter)),
        };
      }),
  );
  return context.runtimes;
};
const runtimeModelsPrepared = async (
  context: CrewContext,
  id: RuntimeId,
  refresh: boolean = false,
): Promise<RuntimeModelCatalog> => {
  if (id === 'demo' && !context.dev)
    throw new Error('Demo runtime is only available in development mode.');
  if (context.closing) throw new Error('The workspace is closing.');
  const cached = context.modelCatalogs.get(id);
  if (!refresh && cached && cached.expiresAt > Date.now()) return cached.catalog;
  const pending = context.modelRequests.get(id);
  if (pending) return pending;
  const request = (async () => {
    if (refresh) {
      const health = await adapters[id].detect();
      context.runtimes = context.runtimes.map((runtime) =>
        runtime.id === id ? { ...runtime, ...health } : runtime,
      );
    }
    return discoverModels(
      adapters[id],
      context.runtimes.some((runtime) => runtime.id === id && runtime.available),
      context.modelController.signal,
    );
  })()
    .then((catalog) => {
      context.modelCatalogs.set(id, { catalog, expiresAt: Date.now() + 5 * 60 * 1000 });
      context.runtimes = context.runtimes.map((runtime) =>
        runtime.id === id ? { ...runtime, ...catalog } : runtime,
      );
      return catalog;
    })
    .finally(() => context.modelRequests.delete(id));
  context.modelRequests.set(id, request);
  return request;
};

export const runtimeModels = (
  context: CrewContext,
  ...args: Parameters<CrewContext['runtimeModels']>
): Promise<RuntimeModelCatalog> => {
  return context.runtimeMaintenance.metadata(args[0], () =>
    runtimeModelsPrepared(context, ...args),
  );
};
