import { runsWithStatus } from '@pitchcrew/board';
import type { CrewContext } from '../crew/types.ts';

export const profileUpdateInterrupted = (context: CrewContext) => {
  return context.board
    .list<{ status: string }>('profile_proposal')
    .some((proposal) => proposal.status === 'applying');
};
export const assertProfileReady = (context: CrewContext) => {
  if (profileUpdateInterrupted(context))
    throw new Error(
      'Finish the approved profile update on Profile before starting runs or editing notes.',
    );
};

const writes = new WeakMap<CrewContext, Promise<unknown>>();

/**
 * Runs one profile write at a time. A write that arrives while another is in progress (another
 * window saving, a source import) waits its turn instead of failing, then rechecks active runs
 * and any interrupted approved update that happened while it waited. `recovery` names the one
 * approved update a write may continue (its own retry), or `true` for writes that never touch
 * notes (a watch switch).
 */
export const changeProfile = async <T>(
  context: CrewContext,
  action: () => Promise<T>,
  { allowActive = false, recovery }: { allowActive?: boolean; recovery?: true | string } = {},
): Promise<T> => {
  const previous = writes.get(context) ?? Promise.resolve();
  let release!: () => void;
  const turn = new Promise<void>((resolve) => (release = resolve));
  writes.set(
    context,
    previous.then(() => turn),
  );
  await previous;
  try {
    if (
      recovery !== true &&
      context.board
        .list<{ id: string; status: string }>('profile_proposal')
        .some(
          (proposal) =>
            proposal.status === 'applying' && (recovery === undefined || proposal.id !== recovery),
        )
    )
      assertProfileReady(context);
    if (
      !allowActive &&
      (context.controllers.size || runsWithStatus(context.board, ['running']).length > 0)
    )
      throw new Error('Wait for active runs to finish before changing their source profile.');
    context.profileWriting = true;
    context.profileRevision += 1;
    try {
      return await action();
    } finally {
      context.profileWriting = false;
    }
  } finally {
    release();
  }
};
