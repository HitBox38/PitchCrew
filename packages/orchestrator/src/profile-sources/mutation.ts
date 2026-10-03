import type { CrewContext } from '../crew/types.ts';

export async function changeProfile<T>(context: CrewContext, action: () => Promise<T>): Promise<T> {
  if (
    context.controllers.size ||
    context.board.list<{ status: string }>('run').some((run) => run.status === 'running')
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
