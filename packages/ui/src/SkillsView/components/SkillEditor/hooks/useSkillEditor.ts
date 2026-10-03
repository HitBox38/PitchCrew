import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import type { SkillEditorProps } from '@/SkillsView/components/SkillEditor/types.ts';
import type { RoleId } from '@pitchcrew/core';
import { baseSkillUrl } from '@pitchcrew/core/base-skills';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { previewSkill } from '../api.ts';

export function useSkillEditor({
  skill,
  creator,
  roles,
  initialRole,
  importing,
  starter,
  action,
  working,
  onClose,
}: SkillEditorProps) {
  const [name, setName] = useState(skill?.name ?? starter?.name ?? '');
  const [description, setDescription] = useState(skill?.description ?? starter?.description ?? '');
  const [content, setContent] = useState(skill?.content ?? '');
  const [scope, setScope] = useState<'all' | 'roles'>(
    skill?.scope ?? (initialRole || starter ? 'roles' : 'all'),
  );
  const [roleIds, setRoleIds] = useState<RoleId[]>(
    skill?.roleIds ?? (initialRole ? [initialRole] : (starter?.defaultRoles ?? [])),
  );
  const [error, setError] = useState('');
  const [source, setSource] = useState(skill?.source);
  const [url, setUrl] = useState(skill?.source?.url ?? (starter ? baseSkillUrl(starter) : ''));
  const [loading, setLoading] = useState(false);
  const dirty =
    name !== (skill?.name ?? starter?.name ?? '') ||
    description !== (skill?.description ?? starter?.description ?? '') ||
    content !== (skill?.content ?? '') ||
    scope !== (skill?.scope ?? (initialRole || starter ? 'roles' : 'all')) ||
    JSON.stringify(roleIds) !==
      JSON.stringify(
        skill?.roleIds ?? (initialRole ? [initialRole] : (starter?.defaultRoles ?? [])),
      );
  const guard = useUnsavedChanges(dirty, onClose);
  const close = () => guard.requestLeave(onClose);
  const importRequest = useRef<AbortController | null>(null);
  useEffect(() => () => importRequest.current?.abort(), []);
  async function loadSkill() {
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
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (loading || working) return;
    setError('');
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
        },
        skill ? 'Updated skill' : 'Added skill',
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save skill.');
    }
  }
  return {
    skill,
    creator,
    roles,
    importing,
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
}
