import { HISTORY_PAGE_SIZE } from '../history.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { useHistoryWindow } from '../hooks/useHistoryWindow.ts';

export const HistoryNavigation = ({
  page,
  total,
}: {
  page: Omit<ReturnType<typeof useHistoryWindow>, 'navigate'> & {
    pending?: boolean;
    navigate: (anchor: string | null) => void;
  };
  total: number;
}) => {
  return (
    <nav
      aria-label="Conversation history"
      className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b border-border p-2 text-detail"
    >
      <Button
        size="sm"
        variant="ghost"
        disabled={!page.older}
        aria-disabled={page.pending || undefined}
        onClick={() => {
          if (!page.pending) page.navigate(page.older);
        }}
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
        aria-disabled={page.pending || undefined}
        onClick={() => {
          if (!page.pending)
            page.navigate(page.end + HISTORY_PAGE_SIZE >= total ? null : page.newer);
        }}
      >
        Newer
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={page.latest}
        aria-disabled={page.pending || undefined}
        onClick={() => {
          if (!page.pending) page.navigate(null);
        }}
      >
        Latest
      </Button>
    </nav>
  );
};
