import { hasRuntimeRecommendation, recommendRuntime } from '@pitchcrew/adapters';
import { defaultRoles } from '@pitchcrew/board';
import type { Role, RuntimeInfo, RuntimeRecommendation } from '@pitchcrew/core';
import type { CrewContext } from './types.ts';

async function recommendationRuntimes(
  context: CrewContext,
  refresh: boolean,
): Promise<RuntimeInfo[]> {
  if (refresh) await context.detect();
  // All installed runtimes participate; metadata requests never start an inference turn.
  await Promise.all(
    context.runtimes
      .filter((runtime) => runtime.available && runtime.id !== 'demo')
      .map((runtime) => context.runtimeModels(runtime.id, refresh)),
  );
  return context.runtimes;
}

export async function seedRecommendedRoles(context: CrewContext): Promise<void> {
  if (context.dev) return;
  const existing = context.board.list<Role>('role');
  const missing = defaultRoles('claude-code', false).filter(
    (role) => !existing.some((saved) => saved.id === role.id),
  );
  if (!missing.length) return;
  const runtimes = await recommendationRuntimes(context, false);
  context.board.seedRoles(
    'claude-code',
    false,
    new Map(missing.map((role) => [role.id, recommendRuntime(role.id, runtimes)])),
  );
}

export async function runtimeRecommendation(
  context: CrewContext,
  roleId: string,
): Promise<RuntimeRecommendation> {
  const role = context.board.get<Role>('role', roleId);
  if (role.retiredAt) throw new Error('This agent is retired.');
  if (!hasRuntimeRecommendation(roleId))
    throw new Error('Runtime recommendations are available for built-in agents.');
  return recommendRuntime(roleId, await recommendationRuntimes(context, true));
}
