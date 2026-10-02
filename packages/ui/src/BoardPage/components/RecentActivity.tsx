import type { RecentActivityProps } from '@/BoardPage/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { timeAgo } from '@/lib/time.ts';
import { ArrowRight } from 'lucide-react';

export function RecentActivity({ go, recent }: RecentActivityProps) {
  return (
    <section className="recent">
      <div className="section-heading">
        <h2>Recent</h2>
        <Button className="text-button" onClick={() => go('activity')}>
          All activity <ArrowRight size={13} />
        </Button>
      </div>
      <ul>
        {recent.map((event) => (
          <li key={event.id}>
            <span>{event.message}</span>
            <time dateTime={event.createdAt}>{timeAgo(event.createdAt)}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}
