import type { Conversation, Role, RuntimeId, RuntimeModelPreferences } from '@pitchcrew/core';
import type { Board } from '@pitchcrew/board';

/** A catalog preference must not invalidate an existing saved model/reasoning selection. */
export const assertCustomModelsUnused = (
  board: Board,
  id: RuntimeId,
  current: RuntimeModelPreferences,
  next: RuntimeModelPreferences,
) => {
  const definitions = new Map(next.custom.map((model) => [model.value, model]));
  const changed = new Map(
    current.custom
      .filter((model) => {
        const replacement = definitions.get(model.value);
        return (
          !replacement ||
          model.reasoning?.levels.some((level) => !replacement.reasoning?.levels.includes(level))
        );
      })
      .map((model) => [model.value, model]),
  );
  if (!changed.size) return;
  const roles = board.list<Role>('role');
  const affected = (config: Pick<Role, 'runtime' | 'model' | 'reasoning'>) => {
    if (config.runtime !== id) return false;
    const previous = changed.get(config.model);
    if (!previous) return false;
    const replacement = definitions.get(config.model);
    return (
      !replacement ||
      (config.reasoning != null && !replacement.reasoning?.levels.includes(config.reasoning))
    );
  };
  if (roles.some((role) => affected(role)))
    throw new Error(
      'This custom model is still used by an agent. Change its saved model or reasoning before removing this definition.',
    );
  for (const conversation of board.list<Conversation>('conversation')) {
    if (conversation.deletedAt) continue;
    for (const [roleId, override] of Object.entries(conversation.configurations)) {
      const role = roles.find((entry) => entry.id === roleId);
      if (role && affected({ ...role, ...override }))
        throw new Error(
          'This custom model is still used by a conversation. Change its saved model or reasoning before removing this definition.',
        );
    }
  }
};
