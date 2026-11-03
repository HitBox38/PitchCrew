import { requireRole } from './roles.ts';
import type { SkillPreview } from '@pitchcrew/core';
import {
  type Role,
  skillInput,
  skillsShUrl,
  type RoleId,
  type Skill,
  type Snapshot,
} from '@pitchcrew/core';
import { baseSkills, baseSkillUrl, type BaseSkill } from '@pitchcrew/core/base-skills';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { skillDirectory } from '../skills-directory.ts';
import type { CrewContext } from './types.ts';

export const skills = (context: CrewContext, roleId?: RoleId): Skill[] => {
  if (roleId) requireRole(context, roleId);
  return context.board
    .list<Skill>('skill')
    .filter(
      (skill) =>
        !skill.deletedAt && (!roleId || skill.scope === 'all' || skill.roleIds.includes(roleId)),
    );
};
export const hasStarterSkill = (context: CrewContext, starter: BaseSkill): boolean => {
  // Tombstones count too: a user's deletion must survive startup and retries.
  return context.board
    .list<Skill>('skill')
    .some(
      (skill) =>
        skill.name.toLowerCase() === starter.name.toLowerCase() ||
        (starter.sourceType === 'bundled' && skill.bundledId === starter.name) ||
        (starter.sourceType === 'github' &&
          skill.source &&
          [starter.source, ...(starter.sourceAliases ?? [])].some(
            (source) => source.toLowerCase() === skill.source!.repository.toLowerCase(),
          ) &&
          skill.source.path === starter.skillPath),
    );
};
export const seedStarterSkills = async (
  context: CrewContext,
  rolesReady?: Promise<void>,
): Promise<Snapshot['starterSkillErrors']> => {
  if (context.closing) throw new Error('The workspace is closing.');
  if (context.starterRequest) return context.starterRequest;
  context.starterRequest = (async () => {
    const results = await Promise.all(
      baseSkills.map(async (starter) => {
        if (context.hasStarterSkill(starter)) return null;
        try {
          const preview =
            starter.sourceType === 'bundled'
              ? {
                  name: starter.name,
                  description: starter.description,
                  content: starter.content,
                  bundledId: starter.name,
                }
              : await context.previewSkill(baseSkillUrl(starter));
          // Loading public sources is independent of runtime/model discovery. Only commit skills
          // after the final role identities exist, so assignments and creation limits stay valid.
          await rolesReady;
          if (context.closing) throw new Error('The workspace is closing.');
          // A user may have added or removed this skill while its source was loading.
          if (!context.hasStarterSkill(starter))
            context.saveSkill(
              {
                ...preview,
                description:
                  preview.description === '>' ? starter.description : preview.description,
                scope: starter.defaultScope ?? 'roles',
                roleIds: starter.defaultScope === 'all' ? [] : starter.defaultRoles,
              },
              undefined,
              'system',
            );
          return null;
        } catch (error) {
          return {
            name: starter.name,
            error: (error instanceof Error
              ? error.message
              : 'Could not load the starter skill.'
            ).slice(0, 500),
          };
        }
      }),
    );
    context.starterSkillErrors = results.filter(
      (result): result is { name: string; error: string } => result !== null,
    );
    return context.starterSkillErrors;
  })().finally(() => {
    context.starterRequest = undefined;
  });
  return context.starterRequest;
};
export const previewSkill = async (context: CrewContext, url: string): Promise<SkillPreview> => {
  if (context.closing) throw new Error('The workspace is closing.');
  return skillDirectory.preview(skillsShUrl.parse(url), context.modelController.signal);
};
export const saveSkill = (
  context: CrewContext,
  data: unknown,
  id?: string,
  actor: 'user' | 'system' = 'user',
): Skill => {
  const parsed = skillInput.parse(data);
  for (const id of parsed.roleIds) requireRole(context, id);
  const current = id ? context.board.get<Skill>('skill', z.uuid().parse(id)) : undefined;
  if (current?.deletedAt) throw new Error('This skill has been deleted.');
  const bundledId = current?.bundledId ?? parsed.bundledId;
  if (
    bundledId &&
    !baseSkills.some((starter) => starter.sourceType === 'bundled' && starter.name === bundledId)
  )
    throw new Error('Unknown bundled starter skill.');
  if (current?.bundledId && parsed.bundledId && parsed.bundledId !== current.bundledId)
    throw new Error('A bundled starter skill’s identity cannot be changed.');
  const now = new Date().toISOString();
  const skill: Skill = {
    ...parsed,
    ...(bundledId ? { bundledId } : {}),
    ...(current?.source && !parsed.source ? { source: current.source } : {}),
    id: current?.id ?? randomUUID(),
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
  };
  const next = [...context.skills().filter((item) => item.id !== skill.id), skill];
  if (next.length > 100) throw new Error('You can store up to 100 skills.');
  for (const { id: roleId } of context.board.list<Role>('role').filter((role) => !role.retiredAt)) {
    const size = next
      .filter((item) => item.scope === 'all' || item.roleIds.includes(roleId))
      .reduce(
        (total, item) => total + item.name.length + item.description.length + item.content.length,
        0,
      );
    if (size > 60000) throw new Error(`Skills for ${roleId} must total at most 60,000 characters.`);
  }
  context.board.record(
    'skill',
    skill,
    actor,
    `${actor === 'system' ? 'Loaded starter' : current ? 'Updated' : 'Added'} skill: ${skill.name}`,
  );
  return skill;
};
export const deleteSkill = (context: CrewContext, id: string): { ok: boolean } => {
  const skill = context.board.get<Skill>('skill', z.uuid().parse(id));
  if (skill.deletedAt) throw new Error('This skill has been deleted.');
  const now = new Date().toISOString();
  context.board.record(
    'skill',
    { ...skill, deletedAt: now, updatedAt: now },
    'user',
    `Deleted skill: ${skill.name}`,
  );
  return { ok: true };
};
