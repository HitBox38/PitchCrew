import type { FormEvent } from 'react';
import { useState } from 'react';
import type { ProfileFile, ProfileOrganization } from '@pitchcrew/core';
import type { ProfileViewProps } from '@/components/ProfileView/types.ts';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import { api } from '@/api.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useProfileSources } from '@/components/ProfileSources/hooks/useProfileSources.ts';
import { useProfileDocuments } from './useProfileDocuments.ts';
import { useProfileOrganization } from './useProfileOrganization.ts';
import { useProfileSaving } from './useProfileSaving.ts';
import { documentDirty } from '../documents.ts';
import { filenameFor, saveBlocker } from '../helpers.ts';
import { readAutosave, writeAutosave } from '../layout.ts';

const patch = (next: { profile?: ProfileFile[]; profileOrganization?: ProfileOrganization }) =>
  useWorkspaceStore.setState((state) =>
    state.data ? { data: { ...state.data, ...next } } : state,
  );
const notify = (toast: string, toastType: 'success' | 'error' = 'success') =>
  useWorkspaceStore.setState({ toast, toastType });
const failure = (error: unknown, fallback: string) =>
  notify(error instanceof Error ? error.message : fallback, 'error');

export const useProfileView = ({ data, action, working }: ProfileViewProps) => {
  const documents = useProfileDocuments(data);
  const organization = useProfileOrganization({ action });
  const blocker = saveBlocker(data.runs, data.profileProposals);
  const [autosave, setAutosave] = useState(readAutosave);
  const saving = useProfileSaving(documents, blocker, autosave);
  const [closing, setClosing] = useState<string | null>(null);
  const [trash, setTrash] = useState<{ trashId: string; name: string } | null>(null);
  const sourcesOpen = useWorkspaceStore((state) => state.profileSources.open);
  const updateSources = useWorkspaceStore((state) => state.updateProfileSources);
  const setSourcesOpen = (open: boolean) => updateSources({ open });
  const flush = autosave && !blocker ? saving.saveAll : undefined;
  const guard = useUnsavedChanges(documents.dirty, documents.discard, flush);
  const sourceController = useProfileSources(
    {
      data,
      action,
      working,
      requestImport: (run) =>
        guard.requestLeave(() => {
          documents.discard();
          run();
        }),
      openImported: (note) => {
        documents.open(note, { replace: true });
        setSourcesOpen(false);
      },
    },
    sourcesOpen,
  );
  const taken = () => [
    ...data.profile.map((file) => file.name),
    ...documents.ref.current.documents.map((file) => file.saved.name),
  ];
  const active = documents.active;
  return {
    data,
    working,
    autosave,
    setAutosave: (enabled: boolean) => {
      setAutosave(enabled);
      writeAutosave(enabled);
    },
    active,
    name: active?.name ?? '',
    activeSavedName: active?.saved.name ?? '',
    content: active?.content ?? '',
    error: active?.error ?? '',
    dirty: active ? documentDirty(active) : false,
    blocker,
    setContent: (content: string) => {
      if (active) documents.update(active.id, { content, error: '' });
    },
    save: async (event?: FormEvent) => {
      event?.preventDefault();
      if (active) await saving.save(active.id);
    },
    saveAll: saving.saveAll,
    taken,
    openNote: (note: { name: string; content: string }) => documents.open(note),
    /** Opens a new, not yet saved note titled `title`; autosave writes it within a second. */
    createNote: async (title: string, folder = '') => {
      const name = filenameFor(title, taken());
      if (folder || Object.hasOwn(data.profileOrganization?.locations ?? {}, name))
        if (!(await organization.change({ action: 'move', name, folder }))) return false;
      documents.open(
        { name, content: title.trim() ? `# ${title.trim()}\n\n` : '' },
        { persisted: false },
      );
      return true;
    },
    /** Renames on disk after any save of the note finishes; an unsaved note just changes name. */
    renameNote: (from: string, to: string) =>
      saving.enqueue(async () => {
        const open = documents.ref.current.documents.find((entry) => entry.saved.name === from);
        if (open && !open.persisted) return documents.rename(from, to);
        try {
          const result = await api<{ profile: ProfileFile[]; organization: ProfileOrganization }>(
            '/profile/rename',
            'POST',
            { from, to },
          );
          documents.rename(from, to);
          patch({ profile: result.profile, profileOrganization: result.organization });
          notify(`Renamed to ${to}`);
        } catch (error) {
          failure(error, 'Could not rename this note.');
        }
      }),
    /**
     * Moves the note to the trash once any save of it finishes, so a first save still in flight
     * cannot bring a deleted note back. A note that never reached disk just closes.
     */
    deleteNote: (name: string) =>
      saving.enqueue(async () => {
        const open = documents.ref.current.documents.filter((entry) => entry.saved.name === name);
        const ids = open.map((entry) => entry.id);
        if (open.length && open.every((entry) => !entry.persisted)) return documents.closeMany(ids);
        try {
          const result = await api<{ trashId: string; profile: ProfileFile[] }>(
            `/profile/${encodeURIComponent(name)}`,
            'DELETE',
          );
          documents.closeMany(ids);
          patch({ profile: result.profile });
          setTrash({ trashId: result.trashId, name });
        } catch (error) {
          failure(error, 'Could not delete this note.');
        }
      }),
    trash,
    dismissTrash: () => setTrash(null),
    /** Restores a note from the trash (the last deletion by default) and opens it. */
    restoreNote: (trashId = trash?.trashId) =>
      saving.enqueue(async () => {
        if (!trashId) return false;
        try {
          const result = await api<{
            name: string;
            profile: ProfileFile[];
            organization: ProfileOrganization;
          }>('/profile/restore', 'POST', { trashId });
          patch({ profile: result.profile, profileOrganization: result.organization });
          const note = result.profile.find((file) => file.name === result.name);
          if (note) documents.open(note);
          if (trash?.trashId === trashId) setTrash(null);
          notify(`Restored ${result.name}`);
          return true;
        } catch (error) {
          failure(error, 'Could not restore this note.');
          return false;
        }
      }),
    /** Load the saved copy, or keep the draft and write it over the copy on disk right away. */
    resolveConflict: (id: string, keep: 'disk' | 'mine') => {
      documents.resolve(id, keep);
      if (keep === 'mine') requestAnimationFrame(() => void saving.save(id));
    },
    documents: documents.documents,
    activeId: documents.activeId,
    selectNote: documents.select,
    reorderNote: documents.reorder,
    /** Closes a clean tab; with autosave, a draft is saved (including late typing) first. */
    closeNote: (id: string) => {
      const note = documents.documents.find((document) => document.id === id);
      if (!note || !documentDirty(note)) return note && documents.close(id);
      if (!autosave || blocker || note.conflict) return setClosing(id);
      void saving.save(id).then((clean) => (clean ? documents.close(id) : setClosing(id)));
    },
    /** Closes several tabs; drafts save first with autosave, otherwise they stay open. */
    closeMany: async (ids: string[]) => {
      const kept: string[] = [];
      for (const id of ids) {
        const note = documents.ref.current.documents.find((document) => document.id === id);
        if (!note) continue;
        const canSave = autosave && !blocker && !note.conflict;
        if (!documentDirty(note) || (canSave && (await saving.save(id)))) documents.close(id);
        else kept.push(note.name);
      }
      if (kept.length) notify(`Kept ${kept.join(', ')} open: unsaved changes`, 'error');
    },
    guard: {
      ...guard,
      open: Boolean(closing) || guard.open,
      discard: () => {
        if (closing) {
          documents.close(closing);
          setClosing(null);
        } else guard.discard();
      },
      keepEditing: () => {
        setClosing(null);
        guard.keepEditing();
      },
    },
    sourceController,
    organization,
    sourcesOpen,
    setSourcesOpen,
  };
};
