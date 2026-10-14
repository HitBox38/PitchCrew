import { HISTORY_PAGE_SIZE } from '../history.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { useHistoryWindow } from '../hooks/useHistoryWindow.ts';

export function HistoryNavigation({
  page,
  total,
}: {
  page: ReturnType<typeof useHistoryWindow>;
  total: number;
}) {
  return (
    <nav
      aria-label="Conversation history"
      className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b border-border p-2 text-detail"
    >
      <Button
        size="sm"
        variant="ghost"
        disabled={!page.older}
        onClick={() => page.navigate(page.older)}
      >
        Older
      </Button>
      <output aria-live="polite" aria-atomic="true">
        {page.start + 1}–{page.end} of {total} entries
      </output>
      <Button
        size="sm"
        variant="ghost"
        disabled={!page.newer}
        onClick={() => page.navigate(page.end + HISTORY_PAGE_SIZE >= total ? null : page.newer)}
      >
        Newer
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={page.latest}
        onClick={() => page.navigate(null)}
      >
        Latest
      </Button>
    </nav>
  );
}
