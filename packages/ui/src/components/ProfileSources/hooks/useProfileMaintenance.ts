import { api } from '@/api.ts';
import type { ProfileSource } from '@pitchcrew/core';
import { useState } from 'react';
import { githubInput } from '../helpers.ts';
import type { ProfileSourcesProps } from '../types.ts';

export function useProfileMaintenance(
  props: ProfileSourcesProps,
  setSources: (sources: ProfileSource[]) => void,
) {
  const [maintenanceError, setError] = useState('');
  async function watch(id: string, watching: boolean) {
    try {
      setError('');
      await props.action(
        `/profile/sources/${id}/watch`,
        'PUT',
        { watching },
        watching ? 'Source watching enabled' : 'Source watching paused',
      );
      setSources(await api<ProfileSource[]>('/profile/sources'));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update watching.');
    }
  }
  async function watchProject(repository: string, path: string, branch: string) {
    try {
      setError('');
      await props.action(
        '/profile/sources/project',
        'POST',
        githubInput(repository, path, branch),
        'Project watch added',
      );
      setSources(await api<ProfileSource[]>('/profile/sources'));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not watch this project.');
    }
  }
  return { maintenanceError, watch, watchProject, maintenance: props };
}
