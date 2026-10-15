import { Button } from '@/components/ui/button/components/Button.tsx';
import type { useJobPage } from '../hooks/useJobPage.ts';

export function JobPages({
  label,
  disabled,
  ...model
}: ReturnType<typeof useJobPage> & {
  label: string;
  disabled: boolean;
}) {
  if (model.pages <= 1) return null;
  return (
    <nav
      aria-label={`${label} pages`}
      className="flex shrink-0 flex-wrap items-center justify-between gap-1 py-1 text-xs"
    >
      <Button
        size="sm"
        variant="ghost"
        disabled={disabled || model.page === 0}
        onClick={() => model.setPage(model.page - 1)}
        aria-label={`Previous ${label} page`}
      >
        Previous
      </Button>
      <output>
        {model.start + 1}–{model.end} of {model.total}
      </output>
      <Button
        size="sm"
        variant="ghost"
        disabled={disabled || model.page + 1 === model.pages}
        onClick={() => model.setPage(model.page + 1)}
        aria-label={`Next ${label} page`}
      >
        Next
      </Button>
    </nav>
  );
}
