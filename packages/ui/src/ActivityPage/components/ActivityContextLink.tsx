import { Link } from '@tanstack/react-router';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { ActivityContext } from '../history.ts';

/** The job, conversation, run or page an event belongs to. */
export const ActivityContextLink = ({ context }: { context: ActivityContext }) => {
  const openCard = useWorkspaceStore((state) => state.openCard);
  if (context.type === 'job')
    return (
      <button type="button" className="activity-context" onClick={() => openCard(context.cardId)}>
        {context.label}
      </button>
    );
  if (context.type === 'chat')
    return (
      <Link
        className="activity-context"
        to="/chat/$thread"
        params={{ thread: context.thread }}
        search={context.run ? { run: context.run } : {}}
      >
        {context.label}
      </Link>
    );
  return (
    <Link className="activity-context" to={context.to}>
      {context.label}
    </Link>
  );
};
