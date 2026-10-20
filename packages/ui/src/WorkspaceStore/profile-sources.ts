import type { ProfileSourcePreview } from '@pitchcrew/core';
import type {
  SourceIntent,
  SourceNotice,
  SourceProvider,
} from '../components/ProfileSources/types.ts';
import type { WorkspaceGet, WorkspaceSet } from './types.ts';

interface ProfileSourcesState {
  open: boolean;
  revision: number;
  adding: boolean;
  provider: SourceProvider | null;
  intent: SourceIntent | null;
  repository: string;
  path: string;
  branch: string;
  folder: string;
  preview: ProfileSourcePreview | null;
  selected: string[];
  notice: SourceNotice | null;
  error: string;
  progress: { label: string; sourceId?: string } | null;
}

export interface ProfileSourcesActions {
  profileSources: ProfileSourcesState;
  updateProfileSources: (
    update:
      | Partial<ProfileSourcesState>
      | ((state: ProfileSourcesState) => Partial<ProfileSourcesState>),
  ) => void;
  performProfileSourceTask: (
    label: string,
    action: () => Promise<void>,
    sourceId?: string,
  ) => Promise<void>;
}

/** Source requests and their review results outlive dialogs and routed pages. */
export const createProfileSourcesActions = (
  set: WorkspaceSet,
  get: WorkspaceGet,
): ProfileSourcesActions => ({
  profileSources: {
    open: false,
    revision: 0,
    adding: false,
    provider: null,
    intent: null,
    repository: '',
    path: 'about-me',
    branch: '',
    folder: '',
    preview: null,
    selected: [],
    notice: null,
    error: '',
    progress: null,
  },
  updateProfileSources: (update) =>
    set((state) => ({
      profileSources: {
        ...state.profileSources,
        ...(typeof update === 'function' ? update(state.profileSources) : update),
      },
    })),
  performProfileSourceTask: async (label, action, sourceId) => {
    if (get().profileSources.progress) return;
    const update = get().updateProfileSources;
    update({ error: '', notice: null, progress: { label, sourceId } });
    try {
      await action();
      const state = get().profileSources;
      get().setToast(
        state.notice?.message ??
          (state.preview ? 'Profile documents ready to review.' : 'Profile source updated.'),
        'success',
      );
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : 'Could not update this source.';
      update({ error });
      get().setToast(error, 'error');
    } finally {
      update((state) => ({ progress: null, revision: state.revision + 1 }));
    }
  },
});
