import { checkSkillUpdates } from '../AgentUpdates/api.ts';
import { isPendingSkillUpdate } from '@pitchcrew/core/skill-updates';
import type { WorkspaceGet, WorkspaceSet } from './types.ts';

export interface SkillUpdateActions {
  checkingSkills: boolean;
  checkSkills: (manual?: boolean) => Promise<void>;
}

export function createSkillUpdateActions(set: WorkspaceSet, get: WorkspaceGet): SkillUpdateActions {
  let request: Promise<void> | undefined;
  return {
    checkingSkills: false,
    checkSkills: (manual = true) => {
      if (request) return request;
      set({ checkingSkills: true });
      request = (async () => {
        try {
          const state = await checkSkillUpdates(!manual);
          await get().reload();
          if (manual) {
            const pending = state.checks.filter(isPendingSkillUpdate).length;
            const failed = state.checks.filter((check) => check.error).length;
            get().setToast(
              failed
                ? `Couldn’t check ${failed} skill${failed === 1 ? '' : 's'}. See Skills for details.`
                : pending
                  ? `${pending} skill update${pending === 1 ? '' : 's'} available.`
                  : 'No pending skill updates.',
              failed ? 'error' : 'success',
            );
          }
        } catch {
          if (manual) get().setToast('Couldn’t check skill updates. Try again later.', 'error');
        } finally {
          request = undefined;
          set({ checkingSkills: false });
        }
      })();
      return request;
    },
  };
}
