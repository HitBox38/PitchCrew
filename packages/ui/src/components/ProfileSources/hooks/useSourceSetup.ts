import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { SourceIntent, SourceProvider } from '../types.ts';

export const useSourceSetup = () => {
  const chooseProvider = (provider: SourceProvider) =>
    update({ provider, intent: provider === 'drive' ? 'notes' : null, adding: true });
  const chooseIntent = (intent: SourceIntent) =>
    update({ intent, path: intent === 'project' ? '' : 'about-me' });
  const startAdd = (provider?: SourceProvider) =>
    update({
      repository: '',
      path: 'about-me',
      branch: '',
      folder: '',
      provider: provider ?? null,
      intent: provider === 'drive' ? 'notes' : null,
      adding: true,
    });

  const { adding, provider, intent, repository, path, branch, folder } = useWorkspaceStore(
    (state) => state.profileSources,
  );
  const update = useWorkspaceStore((state) => state.updateProfileSources);
  const setAdding = (adding: boolean) => update({ adding });
  const setRepository = (repository: string) => update({ repository });
  const setPath = (path: string) => update({ path });
  const setBranch = (branch: string) => update({ branch });
  const setFolder = (folder: string) => update({ folder });
  return {
    adding,
    setAdding,
    provider,
    intent,
    repository,
    setRepository,
    path,
    setPath,
    branch,
    setBranch,
    folder,
    setFolder,
    chooseProvider,
    chooseIntent,
    startAdd,
  };
};
