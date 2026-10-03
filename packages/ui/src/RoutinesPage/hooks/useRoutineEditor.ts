import { useState, type FormEvent } from 'react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import { draftInput, initialDraft } from '../helpers.ts';
import type { EditorProps, RoutineDraft } from '../types.ts';

export function useRoutineEditor(props: EditorProps) {
  const [initial] = useState(() => ({
    ...initialDraft(props.routine),
    ...(!props.routine ? { roleId: props.roles.find((role) => !role.retiredAt)?.id ?? '' } : {}),
  }));
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const guard = useUnsavedChanges(
    !saved && JSON.stringify(initial) !== JSON.stringify(draft),
    props.onClose,
  );
  const change = (patch: Partial<RoutineDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const close = () => {
    if (!props.working) guard.requestLeave(props.onClose);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const input = draftInput(draft);
      // Preserve exact instants, including the later offset during a repeated DST hour.
      if (props.routine && draft.timezone === initial.timezone) {
        if (draft.startLocal === initial.startLocal) input.startAt = props.routine.startAt;
        if (draft.endLocal === initial.endLocal) input.endsAt = props.routine.endsAt;
      }
      await props.action(
        props.routine ? `/routines/${props.routine.id}` : '/routines',
        props.routine ? 'PUT' : 'POST',
        input,
        'Saved routine',
      );
      setSaved(true);
      props.onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save routine.');
    }
  };
  return { draft, change, guard, close, save, error };
}
