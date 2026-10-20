import type { RecentActivityProps } from '@/BoardPage/types.ts';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { timeAgo } from '@/lib/time.ts';
import { ArrowRight, History } from 'lucide-react';

export const RecentActivity = ({ go, recent }: RecentActivityProps) => {
  return (
    <footer className="board-recent flex shrink-0 items-start gap-3 border-t border-border pt-2">
      <Accordion className="min-w-0 flex-1" defaultValue={[]}>
        <AccordionItem value="recent">
          <AccordionTrigger
            className="board-recent-trigger min-h-7 min-w-0 gap-2 py-0 font-sans text-xs font-normal"
            aria-label="Recent activity"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <History size={14} className="shrink-0" aria-hidden="true" />
              <span className="shrink-0">Recent activity</span>
              <span className="board-latest truncate">{recent[0].message}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="mt-2 max-h-36 overflow-auto">
              {recent.map((event) => (
                <li key={event.id} className="flex items-baseline justify-between gap-4 py-2">
                  <span>{event.message}</span>
                  <time dateTime={event.createdAt}>{timeAgo(event.createdAt)}</time>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <Button className="text-button" onClick={() => go('activity')}>
        All activity <ArrowRight size={13} />
      </Button>
    </footer>
  );
};
