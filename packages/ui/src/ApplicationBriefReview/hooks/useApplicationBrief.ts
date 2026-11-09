import { useDirtyNotification } from '@/hooks/useDirtyNotification.ts';
import { api } from '@/api.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { ExtractedJob } from '@pitchcrew/core';
import { useEffect, useRef, useState } from 'react';
import {
  briefConfirmationBlocker,
  briefFromContext,
  emptyBrief,
  normalizedBrief,
} from '../helpers.ts';
import type { ApplicationBriefProps, ContextResponse } from '../types.ts';

export const useApplicationBrief = ({
  card,
  roles,
  busy,
  onDirtyChange,
  onInspection,
}: ApplicationBriefProps) => {
  const action = useWorkspaceStore((state) => state.action);
  const [loaded, setLoaded] = useState<ContextResponse | null>(null);
  const [draft, setDraft] = useState<ExtractedJob>(emptyBrief);
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(editing);
  const savingRef = useRef(false);
  const sourceKey = JSON.stringify([
    card.company,
    card.title,
    card.location,
    card.salary,
    card.url,
    card.description,
    card.sourceHtml,
    card.formAssessments?.at(-1)?.id,
  ]);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);
  const dirty = Boolean(
    editing &&
    loaded &&
    JSON.stringify(normalizedBrief(draft)) !==
      JSON.stringify(normalizedBrief(briefFromContext(loaded))),
  );
  useDirtyNotification(dirty, onDirtyChange);
  const available = roles.filter(
    (role) =>
      role.enabled &&
      !role.retiredAt &&
      ['demo', 'codex', 'claude-code', 'opencode'].includes(role.runtime),
  );
  const [roleId, setRoleId] = useState(
    () =>
      available.find((role) => role.workflow === 'writer' || role.id === 'writer')?.id ??
      available[0]?.id ??
      '',
  );
  const formAgents = roles.filter(
    (role) =>
      role.enabled &&
      !role.retiredAt &&
      role.capabilities?.computerUse &&
      role.capabilities.assessForms,
  );
  const [formRoleId, setFormRoleId] = useState(
    () => formAgents.find((role) => role.id === 'submitter')?.id ?? formAgents[0]?.id ?? '',
  );
  useEffect(() => {
    let cancelled = false;
    void api<ContextResponse>(`/cards/${card.id}/application-context`)
      .then((result) => {
        if (cancelled) return;
        if (savingRef.current) return;
        if (editingRef.current) {
          setError(
            'The brief changed while you were editing. Close and reopen the job to review its current version.',
          );
          return;
        }
        setLoaded(result);
        setDraft(briefFromContext(result));
      })
      .catch((failure) => {
        if (!cancelled)
          setError(failure instanceof Error ? failure.message : 'Could not load the brief.');
      });
    return () => {
      cancelled = true;
    };
  }, [
    card.id,
    card.applicationContext?.revision,
    card.applicationContext?.confirmedAt,
    sourceKey,
    attempt,
  ]);
  const perform = async (path: string, body: unknown, message: string) => {
    setError('');
    savingRef.current = true;
    try {
      await action(`/cards/${card.id}/${path}`, 'POST', body, message);
      const result = await api<ContextResponse>(`/cards/${card.id}/application-context`);
      setLoaded(result);
      setDraft(briefFromContext(result));
      editingRef.current = false;
      setEditing(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Action failed.');
    } finally {
      savingRef.current = false;
    }
  };
  const confirmationHint = briefConfirmationBlocker({
    loaded,
    draft,
    busy,
    linked: Boolean(card.url),
  });
  // Footer and inline buttons share this action; a second press during a save is ignored.
  const confirm = () =>
    loaded &&
    !confirmationHint &&
    !savingRef.current &&
    perform(
      'application-context/confirm',
      {
        sourceRevision: loaded.sourceRevision,
        expectedRevision: loaded.context?.revision ?? null,
        context: normalizedBrief(draft),
      },
      'Application brief confirmed',
    );
  const extract = () =>
    perform('application-context/extract', { roleId }, 'Source extraction started');
  const inspectForm = async () => {
    setError('');
    try {
      const result = (await action(
        `/cards/${card.id}/application-form/inspect`,
        'POST',
        { roleId: formRoleId },
        'Form inspection queued',
      )) as { threadId: string };
      onInspection?.(result.threadId);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not start form inspection.');
    }
  };
  const startDraft = () =>
    action(
      '/queue/actions',
      'POST',
      { cardId: card.id, roleId, action: 'draft' },
      'Application draft queued',
    );
  const reviewer = available.find(
    (role) => role.workflow === 'reviewer' || (!role.workflow && role.id === 'reviewer'),
  );
  const reviewPacket = () =>
    reviewer &&
    action(
      '/queue/actions',
      'POST',
      { cardId: card.id, roleId: reviewer.id, action: 'review' },
      'Packet review queued',
    );
  const confirmed =
    Boolean(
      loaded?.context?.confirmedAt &&
      loaded.context.confirmedRevision === loaded.context.revision &&
      loaded.context.sourceRevision === loaded.sourceRevision,
    ) && Boolean(loaded?.formCurrent);
  return {
    draft,
    setDraft,
    loaded,
    error,
    retry: () => {
      setError('');
      retry((value) => value + 1);
    },
    editing,
    setEditing,
    cancelEditing: () => {
      setDraft(loaded ? briefFromContext(loaded) : emptyBrief());
      setEditing(false);
    },
    available,
    formAgents,
    formRoleId,
    setFormRoleId,
    inspectForm,
    roleId,
    setRoleId,
    confirm,
    confirmDisabled: Boolean(confirmationHint),
    confirmationHint,
    extract,
    startDraft,
    reviewPacket,
    reviewer,
    confirmed,
    disabled: busy || !loaded,
  };
};
