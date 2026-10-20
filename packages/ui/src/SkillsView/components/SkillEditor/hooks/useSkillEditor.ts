import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import type { SkillEditorProps } from '@/SkillsView/components/SkillEditor/types.ts';
import type { RoleId } from '@pitchcrew/core';
import { baseSkillUrl } from '@pitchcrew/core/base-skills';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { previewSkill } from '../api.ts';

export const useSkillEditor = ({
  skill,
  creator,
  roles,
  initialRole,
  importing,
  starter,
  action,
  working,
  onClose,
}: SkillEditorProps) => {
  const loadSkill = async () => {
    importRequest.current?.abort();
    const controller = new AbortController();
    importRequest.current = controller;
    setLoading(true);
    setError('');
    try {
      const preview = await previewSkill(url, controller.signal);
      if (controller.signal.aborted) return;
      setName(preview.name);
      setDescription(preview.description);
      setContent(preview.content);
      setSource(preview.source);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : 'Could not load skill.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (loading || working) return;
    setError('');
    if (!content.trim()) {
      setError('Write instructions before saving the skill.');
      return;
    }
    if (scope === 'roles' && !roleIds.length) {
      setError('Choose at least one agent.');
      return;
    }
    try {
      await action(
        skill ? `/skills/${skill.id}` : '/skills',
        skill ? 'PUT' : 'POST',
        {
          name,
          description,
          content,
          scope,
          roleIds: scope === 'all' ? [] : roleIds,
          ...(source ? { source } : {}),
          ...((skill?.bundledId ?? (starter?.sourceType === 'bundled' ? starter.name : undefined))
            ? { bundledId: skill?.bundledId ?? starter?.name }
            : {}),
        },
        skill ? 'Updated skill' : 'Added skill',
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save skill.');
    }
  };

  const [name, setName] = useState(skill?.name ?? starter?.name ?? '');
  const [description, setDescription] = useState(skill?.description ?? starter?.description ?? '');
  const initialContent =
    skill?.content ?? (starter?.sourceType === 'bundled' ? starter.content : '');
  const initialScope =
    skill?.scope ?? starter?.defaultScope ?? (initialRole || starter ? 'roles' : 'all');
  const initialRoles =
    skill?.roleIds ??
    (starter?.defaultScope === 'all'
      ? []
      : initialRole
        ? [initialRole]
        : (starter?.defaultRoles ?? []));
  const [content, setContent] = useState(initialContent);
  const [scope, setScope] = useState<'all' | 'roles'>(initialScope);
  const [roleIds, setRoleIds] = useState<RoleId[]>(initialRoles);
  const [error, setError] = useState('');
  const [source, setSource] = useState(skill?.source);
  const [url, setUrl] = useState(skill?.source?.url ?? (starter ? baseSkillUrl(starter) : ''));
  const [loading, setLoading] = useState(false);
  const dirty =
    name !== (skill?.name ?? starter?.name ?? '') ||
    description !== (skill?.description ?? starter?.description ?? '') ||
    content !== initialContent ||
    scope !== initialScope ||
    JSON.stringify(roleIds) !== JSON.stringify(initialRoles);
  const guard = useUnsavedChanges(dirty, onClose);
  const close = () => guard.requestLeave(onClose);
  const importRequest = useRef<AbortController | null>(null);
  useEffect(() => () => importRequest.current?.abort(), []);
  return {
    skill,
    creator: starter?.sourceType === 'bundled' ? 'Pitchcrew' : creator,
    roles,
    importing: importing && starter?.sourceType !== 'bundled',
    starter,
    working,
    onClose: close,
    guard,
    name,
    setName,
    description,
    setDescription,
    content,
    setContent,
    scope,
    setScope,
    roleIds,
    setRoleIds,
    error,
    setError,
    source,
    url,
    setUrl,
    loading,
    setLoading,
    loadSkill,
    save,
  };
};
