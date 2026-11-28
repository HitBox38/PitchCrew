import { roleIdSchema, type Role, type RoleId } from '@pitchcrew/core';
import type { CrewContext } from './types.ts';

export const requireRole = (context: CrewContext, id: RoleId): Role => {
  const role = context.board.get<Role>('role', roleIdSchema.parse(id));
  if (role.retiredAt) throw new Error('This role is retired.');
  return role;
};
