import { adapters, discoverModels, suggestedModels } from '@pitchcrew/adapters';
import { type RuntimeId, type RuntimeInfo, type RuntimeModelCatalog } from '@pitchcrew/core';
import type { CrewContext } from './types.ts';

export async function detect(this: CrewContext): Promise<RuntimeInfo[]> {
  this.runtimes = await Promise.all(
    Object.values(adapters).map(async (adapter) => {
      const health = await adapter.detect();
      const cached = this.modelCatalogs.get(adapter.id);
      return {
        ...health,
        ...(health.available && cached && cached.expiresAt > Date.now()
          ? cached.catalog
          : suggestedModels(adapter)),
      };
    }),
  );
  return this.runtimes;
}
export async function runtimeModels(
  this: CrewContext,
  id: RuntimeId,
  refresh: boolean = false,
): Promise<RuntimeModelCatalog> {
  if (this.closing) throw new Error('The workspace is closing.');
  const cached = this.modelCatalogs.get(id);
  if (!refresh && cached && cached.expiresAt > Date.now()) return cached.catalog;
  const pending = this.modelRequests.get(id);
  if (pending) return pending;
  const request = (async () => {
    if (refresh) {
      const health = await adapters[id].detect();
      this.runtimes = this.runtimes.map((runtime) =>
        runtime.id === id ? { ...runtime, ...health } : runtime,
      );
    }
    return discoverModels(
      adapters[id],
      this.runtimes.some((runtime) => runtime.id === id && runtime.available),
      this.modelController.signal,
    );
  })()
    .then((catalog) => {
      this.modelCatalogs.set(id, { catalog, expiresAt: Date.now() + 5 * 60 * 1000 });
      this.runtimes = this.runtimes.map((runtime) =>
        runtime.id === id ? { ...runtime, ...catalog } : runtime,
      );
      return catalog;
    })
    .finally(() => this.modelRequests.delete(id));
  this.modelRequests.set(id, request);
  return request;
}
