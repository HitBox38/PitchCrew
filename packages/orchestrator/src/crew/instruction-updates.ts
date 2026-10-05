import {
  instructionUpdateDecision,
  type InstructionUpdate,
  type Role,
  type RoleId,
} from '@pitchcrew/core';
import { requireRole } from './roles.ts';
import type { CrewContext } from './types.ts';

/** Seeded default roles with newer default instructions. Shown only to the user's session. */
export function instructionUpdates(context: CrewContext): InstructionUpdate[] {
  const dismissed = context.instructionUpdatePreferences.dismissed();
  return context.board
    .defaultInstructionStatuses()
    .flatMap((status) =>
      status.state === 'up_to_date'
        ? []
        : [
            {
              ...status,
              state: status.state,
              dismissed: dismissed[status.roleId] === status.revision,
            },
          ],
    );
}

/** The user's decision must name the exact revision they reviewed. */
function reviewedUpdate(context: CrewContext, id: RoleId, input: unknown): InstructionUpdate {
  const { revision } = instructionUpdateDecision.parse(input);
  requireRole(context, id);
  const update = instructionUpdates(context).find((item) => item.roleId === id);
  if (!update) throw new Error('This role has no default instructions update.');
  if (update.revision !== revision)
    throw new Error('The default instructions changed. Review the latest update first.');
  return update;
}

/**
 * Use new default: an ordinary user settings change through configureRole, so the active-run,
 * settings-write and instruction-limit checks apply and generated AGENTS.md/CLAUDE.md refresh.
 * Only instructions change; runtime, model, enabled state, seat and tools stay as saved.
 */
export async function adoptDefaultInstructions(
  context: CrewContext,
  id: RoleId,
  input: unknown,
): Promise<Role> {
  const update = reviewedUpdate(context, id, input);
  const role = requireRole(context, id);
  const saved = await context.configureRole(
    id,
    {
      name: role.name,
      description: role.description,
      workflow: role.workflow,
      runtime: role.runtime,
      model: role.model,
      enabled: role.enabled,
      instructions: update.instructions,
      ...(role.capabilities ? { capabilities: role.capabilities } : {}),
    },
    `Used the new default instructions for ${role.name}`,
  );
  context.instructionUpdatePreferences.clear(id);
  return saved;
}

/** Keep mine: hides this revision until a newer default ships. The role is not changed. */
export function dismissInstructionUpdate(
  context: CrewContext,
  id: RoleId,
  input: unknown,
): InstructionUpdate {
  const update = reviewedUpdate(context, id, input);
  context.instructionUpdatePreferences.dismiss(id, update.revision);
  return { ...update, dismissed: true };
}
