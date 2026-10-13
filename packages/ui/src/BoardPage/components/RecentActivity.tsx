import type { RecentActivityProps } from '@/BoardPage/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { timeAgo } from '@/lib/time.ts';
import { ArrowRight, ChevronDown, History } from 'lucide-react';

export function RecentActivity({ go, recent }: RecentActivityProps) {
  return (
    <footer className="board-recent flex shrink-0 items-start gap-3 border-t border-border pt-2">
      <details className="min-w-0 flex-1">
        <summary className="flex cursor-pointer items-center gap-2">
          <History size={14} />
          Recent activity
          <ChevronDown size={13} className="board-recent-chevron" />
          <span className="board-latest truncate">{recent[0].message}</span>
        </summary>
        <ul className="mt-2 max-h-36 overflow-auto">
          {recent.map((event) => (
            <li key={event.id} className="flex items-baseline justify-between gap-4 py-2">
              <span>{event.message}</span>
              <time dateTime={event.createdAt}>{timeAgo(event.createdAt)}</time>
            </li>
          ))}
        </ul>
      </details>
      <Button className="text-button" onClick={() => go('activity')}>
        All activity <ArrowRight size={13} />
      </Button>
    </footer>
  );
}
