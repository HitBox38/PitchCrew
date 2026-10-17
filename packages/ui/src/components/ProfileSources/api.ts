import type {
  ProfileFile,
  ProfileSource,
  ProfileSourceInput,
  ProfileSourcePreview,
} from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import { api } from '@/api.ts';

export function readSources(signal?: AbortSignal) {
  return api<ProfileSource[]>('/profile/sources', 'GET', undefined, signal);
}
export function readSourceDocuments(input: ProfileSourceInput) {
  return api<ProfileSourcePreview>('/profile/sources/preview', 'POST', input);
}
export async function importSourceDocuments(action: Action, token: string, names: string[]) {
  return (await action(
    '/profile/sources/import',
    'POST',
    { token, names },
    'Profile documents imported',
  )) as ProfileFile[];
}
export function addProjectWatch(action: Action, input: ProfileSourceInput) {
  return action('/profile/sources/project', 'POST', input, 'Project watch added');
}
export function setSourceWatching(action: Action, id: string, watching: boolean) {
  return action(
    `/profile/sources/${id}/watch`,
    'PUT',
    { watching },
    watching ? 'Source watching enabled' : 'Source watching paused',
  );
}
export function removeSource(action: Action, id: string) {
  return action(`/profile/sources/${id}`, 'DELETE', undefined, 'Source removed; local notes kept');
}
