import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import type { SkillEditorProps } from '@/SkillsView/components/SkillEditor/types.ts';
import type { RoleId } from '@pitchcrew/core';
import { initialSkillDraft } from '../helpers.ts';
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
  const initial = initialSkillDraft({ skill, starter, initialRole });
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
      // react-doctor-disable-next-line react-doctor/no-loading-flag-reset-outside-finally -- This reset is inside finally and belongs only to the active request.
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
          ...(initial.bundledId ? { bundledId: initial.bundledId } : {}),
        },
        skill ? 'Updated skill' : 'Added skill',
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save skill.');
    }
  };

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [content, setContent] = useState(initial.content);
  const [scope, setScope] = useState<'all' | 'roles'>(initial.scope);
  const [roleIds, setRoleIds] = useState<RoleId[]>(initial.roleIds);
  const [error, setError] = useState('');
  const [source, setSource] = useState(initial.source);
  const [url, setUrl] = useState(initial.url);
  const [loading, setLoading] = useState(false);
  const dirty =
    name !== initial.name ||
    description !== initial.description ||
    content !== initial.content ||
    scope !== initial.scope ||
    JSON.stringify(roleIds) !== JSON.stringify(initial.roleIds);
  const guard = useUnsavedChanges(dirty, onClose);
  const close = () => guard.requestLeave(onClose);
  const importRequest = useRef<AbortController | null>(null);
  useEffect(() => () => importRequest.current?.abort(), []);
  return {
    skill,
    creator: initial.bundled ? 'Pitchcrew' : creator,
    roles,
    importing: importing && !initial.bundled,
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
