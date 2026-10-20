import { useEffect } from 'react';
import { nextSkillCheckDelay } from '../helpers.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

/** The mounted shell owns checking; a background daemon alone never starts a sweep. */
export const useSkillUpdateChecks = () => {
  const automatic = useWorkspaceStore((state) => state.data?.skillUpdates?.automatic ?? true);
  const sources = useWorkspaceStore((state) =>
    JSON.stringify(
      state.data?.skills.filter((skill) => skill.source).map((skill) => [skill.id, skill.source]),
    ),
  );
  const check = useWorkspaceStore((state) => state.checkSkills);
  useEffect(() => {
    if (!automatic) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      await check(false);
      if (active)
        timer = setTimeout(
          () => void refresh(),
          nextSkillCheckDelay(useWorkspaceStore.getState().data),
        );
    };
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [automatic, sources, check]);
};
