import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import type { LensEntry } from '@/lib/crew-lens.ts';
import { moveBetweenEntries } from '../focus.ts';

type LensLinkProps = {
  entry: Pick<LensEntry, 'state' | 'itemKey' | 'threadId' | 'runId'>;
  className: string;
  label?: string;
  describedBy?: string;
  /** One of the row's arrow-key stops: an entry's own link, never a group member's. */
  stop?: boolean;
  children: ReactNode;
};

/**
 * Where an entry leads: its Needs you item on Home when it waits on the user (the lens decides
 * nothing), the exact run while it runs, otherwise Queue, where its job queue's place, hold and
 * recovery live.
 */
export const LensLink = ({ entry, label, describedBy, stop, ...rest }: LensLinkProps) => {
  const props = {
    ...rest,
    'aria-label': label,
    'aria-describedby': describedBy,
    'data-lens-stop': stop ? '' : undefined,
    onKeyDown: stop ? moveBetweenEntries : undefined,
  };
  if (entry.itemKey) return <Link to="/" search={{ item: entry.itemKey }} {...props} />;
  if (entry.state !== 'running') return <Link to="/queue" {...props} />;
  if (!entry.threadId || !entry.runId)
    return <span className={rest.className}>{rest.children}</span>;
  return (
    <Link
      to="/chat/$thread"
      params={{ thread: entry.threadId }}
      search={{ run: entry.runId }}
      {...props}
    />
  );
};
