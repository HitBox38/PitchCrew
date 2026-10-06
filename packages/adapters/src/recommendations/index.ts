import type {
  ReasoningLevel,
  RuntimeInfo,
  RuntimeModel,
  RuntimeRecommendation,
} from '@pitchcrew/core';
import { recommendationModel } from './models.ts';
import { recommendationPlans, recommendedRuntimeOrder, previousModels } from './plans.ts';

export function hasRuntimeRecommendation(roleId: string): boolean {
  return Object.hasOwn(recommendationPlans, roleId);
}

function selectModel(runtime: RuntimeInfo, key: string, effort: ReasoningLevel) {
  const matches = runtime.models.filter((model) => recommendationModel(runtime.id, model) === key);
  // Cursor embeds effort in the selector; preserve that exact native value.
  return matches.find((model) => model.value.endsWith(`-${effort}`)) ?? matches[0];
}

function configuration(
  runtime: RuntimeInfo,
  model: RuntimeModel | undefined,
  effort: ReasoningLevel,
): RuntimeRecommendation {
  const levels = model?.reasoning?.levels ?? [];
  return {
    runtime: runtime.id,
    model: model?.value ?? '',
    reasoning: levels.includes(effort) ? effort : null,
    available: runtime.available,
    modelSource: runtime.modelSource,
    detail: !runtime.available
      ? 'Install this recommended runtime and configure its native sign-in before enabling the agent.'
      : !model
        ? 'No recommended model was reported. Using CLI default; check native sign-in and model access.'
        : runtime.modelSource === 'runtime'
          ? 'Recommended from installed runtimes and their reported models. Model access remains managed by the CLI.'
          : 'Recommended runtime is installed. This model is a suggestion; check native sign-in and model access.',
  };
}

export function recommendRuntime(
  roleId: string,
  runtimes: readonly RuntimeInfo[],
): RuntimeRecommendation {
  if (!hasRuntimeRecommendation(roleId))
    throw new Error('Runtime recommendations are available for built-in agents.');
  const plan = recommendationPlans[roleId];
  const order = [plan.runtime, ...recommendedRuntimeOrder.filter((id) => id !== plan.runtime)];
  const installed = order.flatMap((id) =>
    runtimes.filter((runtime) => runtime.id === id && runtime.available),
  );
  // Native catalogs win over unverified suggestions, then model fit, then runtime preference.
  for (const source of ['runtime', 'fallback'] as const)
    for (const key of [...plan.models, ...previousModels])
      for (const runtime of installed.filter((runtime) => runtime.modelSource === source)) {
        const model = selectModel(runtime, key, plan.reasoning);
        if (model) return configuration(runtime, model, plan.reasoning);
      }
  const fallback = installed[0] ?? runtimes.find((runtime) => runtime.id === plan.runtime);
  if (!fallback) throw new Error('The recommended runtime is not registered.');
  const model = fallback.available
    ? undefined
    : selectModel(fallback, plan.models[0], plan.reasoning);
  return configuration(fallback, model, plan.reasoning);
}
