import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export const useSourceTask = () => {
  const progress = useWorkspaceStore((state) => state.profileSources.progress);
  const error = useWorkspaceStore((state) => state.profileSources.error);
  const update = useWorkspaceStore((state) => state.updateProfileSources);
  const perform = useWorkspaceStore((state) => state.performProfileSourceTask);
  return { progress, error, setError: (error: string) => update({ error }), perform };
};
