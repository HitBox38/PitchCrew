import { defaultCapabilities, type Role, type Routine } from '@pitchcrew/core';
import { z } from 'zod';
import type { CrewContext, RunCapability } from '../types.ts';
import { deleteRoutine, routines, saveRoutine } from '../routines/index.ts';
import { parseRoutine } from '../routines/schedule.ts';

export function routineAction(
  this: CrewContext,
  capability: RunCapability,
  action: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const source = this.board.get<Role>('role', capability.roleId);
  const permissions = { ...defaultCapabilities, ...source.capabilities };
  const canAccess = (routine: Pick<Routine, 'roleId' | 'cardId'>) => {
    if (routine.roleId !== source.id && !permissions.invokeAgents)
      throw new Error('Invoking other roles is disabled.');
    if (routine.cardId && routine.cardId !== capability.cardId)
      throw new Error('You can only schedule actions on your attached application.');
  };
  if (action === 'routines')
    return {
      routines: routines
        .call(this)
        .filter(
          (routine) =>
            (routine.roleId === source.id || permissions.invokeAgents) &&
            (!routine.cardId || routine.cardId === capability.cardId),
        ),
      now: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  if (!permissions.manageRoutines) throw new Error('Managing routines is disabled for this role.');
  const id = z.uuid().optional().parse(data.routineId);
  if (id) {
    const current = this.board.get<Routine>('routine', id);
    canAccess(current);
  }
  if (action === 'delete_routine') {
    if (!id) throw new Error('Choose a routine to delete.');
    return deleteRoutine.call(this, id, source.id);
  }
  const input = parseRoutine(data.input);
  canAccess(input);
  return { routine: saveRoutine.call(this, input, id, source.id) };
}
