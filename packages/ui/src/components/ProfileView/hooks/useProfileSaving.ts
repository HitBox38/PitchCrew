import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ProfileFile } from '@pitchcrew/core';
import { api, ApiHttpError } from '@/api.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { documentDirty } from '../documents.ts';
import { sha256 } from '../helpers.ts';
import type { ProfileDocument } from '../types.ts';
import type { useProfileDocuments } from './useProfileDocuments.ts';

const autosaveDelay = 800;

/**
 * Updates one note in the shared snapshot. Other notes keep whatever the snapshot last observed,
 * so an older save response can never roll back a newer observation of a different note.
 */
const patchNote = (note: ProfileFile) =>
  useWorkspaceStore.setState((state) => {
    if (!state.data) return state;
    const profile = state.data.profile.some((file) => file.name === note.name)
      ? state.data.profile.map((file) => (file.name === note.name ? note : file))
      : [...state.data.profile, note];
    return { data: { ...state.data, profile } };
  });

/**
 * Writes drafts to disk: on request, and (when enabled) shortly after typing stops. Every profile
 * write from this page runs through one queue, so saves, renames and deletes never overlap; each
 * save reads the note when its turn comes and names the copy it replaces, so a note changed
 * elsewhere is never silently overwritten.
 */
export const useProfileSaving = (
  documents: ReturnType<typeof useProfileDocuments>,
  blocker: string,
  autosave: boolean,
) => {
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(task, task);
    queue.current = run.catch(() => undefined);
    return run;
  };
  const current = (id: string) => documents.ref.current.documents.find((entry) => entry.id === id);
  /** One write of the note's latest text. True when that write succeeded or nothing was due. */
  const write = async (id: string): Promise<boolean> => {
    const document = current(id);
    if (!document || !documentDirty(document)) return true;
    if (document.conflict || blocker) return false;
    const { name, content } = document;
    documents.update(id, { saving: content, error: '' });
    try {
      const baseline = document.persisted ? await sha256(document.saved.content) : null;
      await api<ProfileFile[]>('/profile', 'PUT', { name, content, baseline });
      documents.update(id, (latest: ProfileDocument) => ({
        saving: null,
        persisted: true,
        saved: { name, content },
        // A rename that finished meanwhile keeps its own name; this save wrote the old one.
        ...(latest.saved.name === name ? {} : { saved: latest.saved }),
      }));
      patchNote({ name, content });
      return true;
    } catch (error) {
      if (error instanceof ApiHttpError && error.status === 409) {
        const latest = (error.body as { current?: unknown } | undefined)?.current;
        documents.update(id, {
          saving: null,
          conflict: { current: typeof latest === 'string' ? latest : null },
        });
      } else
        documents.update(id, {
          saving: null,
          error: error instanceof Error ? error.message : 'Could not save this note.',
        });
      return false;
    }
  };
  /** Saves until the note is clean, including text typed while a save was in flight. */
  const saveUntilClean = (id: string) =>
    enqueue(async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        if (!(await write(id))) return false;
        // The next render carries any newer text into the ref; give it a frame to land.
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const document = current(id);
        if (!document || !documentDirty(document)) return true;
      }
      return false;
    });
  /**
   * Saves every draft until none is left, re-reading the open notes each round so a note edited
   * while another was saving (say, during navigation) is saved too. True only when all are clean.
   */
  const saveAll = async () => {
    for (let round = 0; round < 5; round++) {
      const ids = documents.ref.current.documents.filter(documentDirty).map((entry) => entry.id);
      if (!ids.length) return true;
      for (const id of ids) if (!(await saveUntilClean(id))) return false;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return !documents.ref.current.documents.some(documentDirty);
  };
  const flush = useRef(saveAll);
  useLayoutEffect(() => {
    flush.current = saveAll;
  });
  const due = documents.documents.filter(
    (entry) => documentDirty(entry) && !entry.conflict && !entry.error && entry.saving === null,
  );
  // Restarts the quiet period whenever a due draft changes; saves read the latest text.
  const signature = due
    .map((entry) => `${entry.id}:${entry.name}:${entry.content.length}:${entry.persisted}`)
    .join('\0');
  useEffect(() => {
    if (!autosave || blocker || !signature) return;
    const timer = window.setTimeout(() => void flush.current(), autosaveDelay);
    return () => window.clearTimeout(timer);
  }, [autosave, blocker, signature]);
  return { save: saveUntilClean, saveAll, enqueue };
};
