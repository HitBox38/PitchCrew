import type {
  ProfileFile,
  ProfileSource,
  ProfileSourceInput,
  ProfileSourcePreview,
} from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import { api } from '@/api.ts';

export const readSources = (signal?: AbortSignal) => {
  return api<ProfileSource[]>('/profile/sources', 'GET', undefined, signal);
};
export const readSourceDocuments = (input: ProfileSourceInput) => {
  return api<ProfileSourcePreview>('/profile/sources/preview', 'POST', input);
};
export const importSourceDocuments = async (action: Action, token: string, names: string[]) => {
  return (await action(
    '/profile/sources/import',
    'POST',
    { token, names },
    'Profile documents imported',
  )) as ProfileFile[];
};
export const addProjectWatch = (action: Action, input: ProfileSourceInput) => {
  return action('/profile/sources/project', 'POST', input, 'Project watch added');
};
export const setSourceWatching = (action: Action, id: string, watching: boolean) => {
  return action(
    `/profile/sources/${id}/watch`,
    'PUT',
    { watching },
    watching ? 'Source watching enabled' : 'Source watching paused',
  );
};
export const removeSource = (action: Action, id: string) => {
  return action(`/profile/sources/${id}`, 'DELETE', undefined, 'Source removed; local notes kept');
};
