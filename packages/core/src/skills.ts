import { roleIdSchema } from './roles.ts';
import { z } from 'zod';
import { skillContentLimit } from './base-skills.ts';
import { type RoleId } from './states.ts';

export const skillsShUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        ['skills.sh', 'www.skills.sh'].includes(url.hostname) &&
        !url.username &&
        !url.password &&
        !url.port &&
        !url.search &&
        !url.hash &&
        /^\/[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9_-]*\/?$/.test(
          url.pathname,
        )
      );
    } catch {
      return false;
    }
  }, 'Use a skills.sh skill URL: https://skills.sh/owner/repository/skill-name');
export const skillSourceSchema = z
  .object({
    url: skillsShUrl,
    repository: z.string().max(200),
    path: z.string().max(500),
    blobSha: z.string().regex(/^[a-f0-9]{40}$/),
    fetchedAt: z.iso.datetime(),
  })
  .strict();
export const skillAssignment = z
  .object({
    scope: z.enum(['all', 'roles']),
    roleIds: z.array(roleIdSchema).max(50).default([]),
  })
  .refine(
    (value) =>
      (value.scope === 'all' ? value.roleIds.length === 0 : value.roleIds.length > 0) &&
      new Set(value.roleIds).size === value.roleIds.length,
    'Choose all agents or at least one distinct agent.',
  );
export const skillInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).default(''),
    content: z.string().trim().min(1).max(skillContentLimit),
    scope: z.enum(['all', 'roles']),
    roleIds: z.array(roleIdSchema).max(50).default([]),
    source: skillSourceSchema.optional(),
  })
  .strict()
  .refine(
    (skill) => (skill.scope === 'all' ? skill.roleIds.length === 0 : skill.roleIds.length > 0),
    'Choose at least one agent, or choose all agents without individual assignments.',
  )
  .refine(
    (skill) => new Set(skill.roleIds).size === skill.roleIds.length,
    'Choose each agent once.',
  );
export type SkillInput = z.infer<typeof skillInput>;
export interface Skill extends SkillInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
export type SkillPreview = Pick<SkillInput, 'name' | 'description' | 'content' | 'source'>;
export const skillSuggestionInput = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('custom'),
      skill: skillInput.refine(
        (value) => !value.source,
        'Use a skills-sh suggestion to import a source.',
      ),
    })
    .strict(),
  z
    .object({ kind: z.literal('skills-sh'), url: skillsShUrl, assignment: skillAssignment })
    .strict(),
]);
export interface SkillProposal {
  id: string;
  roleId: RoleId;
  runId: string;
  threadId: RoleId | 'crew';
  reason: string;
  skill: SkillInput;
  status: 'pending' | 'applied' | 'rejected';
  skillId: string | null;
  createdAt: string;
}
