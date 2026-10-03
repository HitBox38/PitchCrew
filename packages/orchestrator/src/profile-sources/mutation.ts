import type { CrewContext } from '../crew/types.ts';

export function profileUpdateInterrupted(context: CrewContext) {
  return context.board
    .list<{ status: string }>('profile_proposal')
    .some((proposal) => proposal.status === 'applying');
}
export function assertProfileReady(context: CrewContext) {
  if (profileUpdateInterrupted(context))
    throw new Error(
      'Finish the approved profile update on Profile before starting runs or editing notes.',
    );
}

export async function changeProfile<T>(
  context: CrewContext,
  action: () => Promise<T>,
  allowActive = false,
): Promise<T> {
  if (
    !allowActive &&
    (context.controllers.size ||
      context.board.list<{ status: string }>('run').some((run) => run.status === 'running'))
  )
    throw new Error('Wait for active runs to finish before changing their source profile.');
  if (context.profileWriting) throw new Error('Wait for the current profile update to finish.');
  context.profileWriting = true;
  context.profileRevision += 1;
  try {
    return await action();
  } finally {
    context.profileWriting = false;
  }
}
