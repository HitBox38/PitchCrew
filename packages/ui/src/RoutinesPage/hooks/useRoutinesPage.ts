import { useState } from 'react';
import type { Routine, Snapshot } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
import { routineInput } from '../helpers.ts';

export function useRoutinesPage(data: Snapshot, action: Action) {
  const [editing, setEditing] = useState<Routine | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Routine | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const routines = data.routines
    .filter(
      (routine) =>
        (filter === 'all' || routine.roleId === filter) &&
        `${routine.name} ${routine.content}`.toLowerCase().includes(query.toLowerCase()),
    )
    .toSorted((a, b) =>
      (a.enabled && a.nextRunAt ? a.nextRunAt : 'z').localeCompare(
        b.enabled && b.nextRunAt ? b.nextRunAt : 'z',
      ),
    );
  const toggle = async (routine: Routine) => {
    setError('');
    try {
      await action(
        `/routines/${routine.id}`,
        'PUT',
        { ...routineInput(routine), enabled: !routine.enabled },
        routine.enabled ? 'Paused routine' : 'Resumed routine',
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not change routine.');
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setError('');
    try {
      await action(`/routines/${deleting.id}`, 'DELETE', undefined, 'Deleted routine');
      setDeleting(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not delete routine.');
    }
  };
  return {
    editing,
    setEditing,
    deleting,
    setDeleting,
    query,
    setQuery,
    filter,
    setFilter,
    error,
    routines,
    toggle,
    remove,
  };
}
