import { roleCreate, routineInput, type Skill } from '@pitchcrew/core';
import { z } from 'zod';
import type { CrewContext } from './types.ts';
import { nextOccurrence, parseRoutine } from './routines/schedule.ts';

export const roleSetup = roleCreate
  .extend({
    skills: z
      .array(z.object({ id: z.uuid(), updatedAt: z.iso.datetime() }).strict())
      .max(100)
      .default([]),
    routine: routineInput.optional(),
  })
  .strict();
export type RoleSetup = z.infer<typeof roleSetup>;

/** Recheck after asynchronous instruction writes, before committing any board entities. */
export function validateRoleSetup(context: CrewContext, input: RoleSetup): Skill[] {
  if (!context.dev && input.runtime === 'demo')
    throw new Error('Demo runtime is only available in development mode.');
  if (new Set(input.skills.map((skill) => skill.id)).size !== input.skills.length)
    throw new Error('Choose each skill once.');
  const selected = input.skills.map((reference) => {
    const skill = context.board.get<Skill>('skill', reference.id);
    if (skill.deletedAt || skill.updatedAt !== reference.updatedAt)
      throw new Error('A selected skill changed. Review the current skills and try again.');
    return skill;
  });
  const assigned = context
    .skills()
    .filter((skill) => skill.scope === 'all' || selected.some((item) => item.id === skill.id));
  const total = assigned.reduce(
    (size, skill) => size + skill.name.length + skill.description.length + skill.content.length,
    0,
  );
  if (total > 60000) throw new Error('Assigned skills must total at most 60,000 characters.');
  if (input.routine) {
    if (input.routine.roleId !== input.id)
      throw new Error('The first routine must belong to the new agent.');
    const routine = parseRoutine(input.routine);
    if (!nextOccurrence(routine))
      throw new Error('This schedule has no occurrence before its end.');
    if (routine.cardId) context.board.get('card', routine.cardId);
  }
  return selected;
}
