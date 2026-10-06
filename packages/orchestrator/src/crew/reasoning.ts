import type { Role, RuntimeModelCatalog } from '@pitchcrew/core';

export function validateReasoning(
  role: Pick<Role, 'model' | 'reasoning'>,
  catalog: RuntimeModelCatalog,
): void {
  if (role.reasoning == null) return;
  const model = catalog.models.find((model) => model.value === role.model);
  if (!model?.reasoning?.levels.includes(role.reasoning))
    throw new Error(
      'Choose a reasoning level supported by the selected model, or use CLI default.',
    );
}
