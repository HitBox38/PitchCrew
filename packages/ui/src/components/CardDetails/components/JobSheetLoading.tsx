import type { Card } from '@pitchcrew/core';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Skeleton } from '@/components/ui/skeleton/components/Skeleton.tsx';
import { JobHeading } from './JobHeading.tsx';

export const JobSheetLoading = ({
  card,
  error,
  retry,
  close,
}: {
  card: Card;
  error: string;
  retry: () => void;
  close: () => void;
}) => (
  <div className="flex min-h-0 flex-1 flex-col" aria-busy={!error}>
    <header className="job-summary flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <JobHeading card={card} />
      <Button variant="ghost" onClick={close} aria-label="Close dialog">
        Close
      </Button>
    </header>
    <div className="flex-1 space-y-5 overflow-hidden p-5">
      <p
        role={error ? 'alert' : 'status'}
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        {!error ? (
          <LoaderCircle size={16} className="spin motion-reduce:animate-none" aria-hidden="true" />
        ) : null}
        {error || 'Opening job…'}
      </p>
      {error ? (
        <Button onClick={retry}>Retry</Button>
      ) : (
        <div aria-hidden="true" className="space-y-4 motion-reduce:[&_*]:animate-none">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-5 w-1/3" />
          {[0, 1, 2, 3, 4].map((line) => (
            <Skeleton key={line} className="h-4 w-full last:w-2/3" />
          ))}
        </div>
      )}
    </div>
  </div>
);
