import type { SkillEditorProps } from './types.ts';
import { baseSkillUrl } from '@pitchcrew/core/base-skills';
import { skillIncludedEveryRun } from '@pitchcrew/core/skill-delivery';

export const initialSkillDraft = ({
  skill,
  starter,
  initialRole,
  importing,
}: Pick<SkillEditorProps, 'skill' | 'starter' | 'initialRole' | 'importing'>) => {
  const bundled = starter?.sourceType === 'bundled' ? starter : null;
  return {
    name: skill?.name ?? starter?.name ?? '',
    description: skill?.description ?? starter?.description ?? '',
    content: skill?.content ?? bundled?.content ?? '',
    includeInEveryRun: skill
      ? skillIncludedEveryRun(skill)
      : starter
        ? (starter.includeInEveryRun ?? false)
        : !importing,
    scope: skill?.scope ?? starter?.defaultScope ?? (initialRole || starter ? 'roles' : 'all'),
    roleIds:
      skill?.roleIds ??
      (starter?.defaultScope === 'all'
        ? []
        : initialRole
          ? [initialRole]
          : (starter?.defaultRoles ?? [])),
    source: skill?.source,
    url: skill?.source?.url ?? (starter ? baseSkillUrl(starter) : ''),
    bundledId: skill?.bundledId ?? bundled?.name,
    bundled: !!bundled,
  };
};
