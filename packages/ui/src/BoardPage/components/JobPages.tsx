import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { useJobPage } from '../hooks/useJobPage.ts';

/** Previous / range / Next directly under a column heading, so Next is never buried. */
export const JobPages = ({
  label,
  disabled,
  ...model
}: ReturnType<typeof useJobPage> & {
  label: string;
  disabled: boolean;
}) => {
  if (model.pages <= 1) return null;
  return (
    <nav aria-label={`${label} pages`} className="clay-column-pages">
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={disabled || model.page === 0}
        onClick={() => model.setPage(model.page - 1)}
        aria-label={`Previous ${label} page`}
      >
        <ChevronLeft size={15} />
      </Button>
      <output aria-live="polite">
        {model.start + 1}–{model.end} of {model.total}
      </output>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={disabled || model.page + 1 === model.pages}
        onClick={() => model.setPage(model.page + 1)}
        aria-label={`Next ${label} page`}
      >
        <ChevronRight size={15} />
      </Button>
    </nav>
  );
};
