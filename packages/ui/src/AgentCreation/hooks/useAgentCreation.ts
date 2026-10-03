import { useRef, useState, type FormEvent } from 'react';
import type { Role } from '@pitchcrew/core';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import { createAgent } from '../api.ts';
import { initialCreation, stepError, suggestedId } from '../helpers.ts';
import type { AgentCreationProps, CreationDraft } from '../types.ts';

export function useAgentCreation(props: AgentCreationProps) {
  const [initial] = useState(() => initialCreation(props.data));
  const [draft, setDraft] = useState(initial);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const [created, setCreated] = useState<Role | null>(null);
  const guard = useUnsavedChanges(
    !created && JSON.stringify(initial) !== JSON.stringify(draft),
    props.onClose,
  );
  const changeDraft = (patch: Partial<CreationDraft>) => {
    setError('');
    setDraft((current) => ({ ...current, ...patch }));
  };
  const changeRole = (patch: Partial<Role>) => {
    setError('');
    setDraft((current) => ({ ...current, role: { ...current.role, ...patch } }));
  };
  const changeName = (name: string) => {
    changeRole({
      name,
      ...(draft.role.id === '' || draft.role.id === suggestedId(draft.role.name, props.data.roles)
        ? { id: suggestedId(name, props.data.roles) }
        : {}),
    });
  };
  const close = () => {
    if (!pending.current) guard.requestLeave(props.onClose);
  };
  const goTo = (target: number) => {
    if (pending.current) return;
    if (target > step) {
      const message = stepError(step, draft, props.data);
      if (message) {
        setError(message);
        return;
      }
    }
    setError('');
    setStep(target);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || props.working) return;
    if (step < 5) {
      goTo(step + 1);
      return;
    }
    for (let index = 0; index < 5; index++) {
      const message = stepError(index, draft, props.data);
      if (message) {
        setStep(index);
        setError(message);
        return;
      }
    }
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      const role = await createAgent(draft);
      setCreated(role);
      props.onCreated(role);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not create agent.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  return {
    draft,
    changeDraft,
    changeRole,
    changeName,
    step,
    goTo,
    error,
    saving,
    created,
    close,
    guard,
    submit,
    data: props.data,
    working: props.working,
  };
}
