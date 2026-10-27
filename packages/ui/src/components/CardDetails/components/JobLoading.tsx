import type { CardDetailsProps } from '../types.ts';
import { JobSheet } from './JobSheet.tsx';
import { JobSummary } from './JobSummary.tsx';
import { JobActionFooter } from './JobActionFooter.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Skeleton } from '@/components/ui/skeleton/components/Skeleton.tsx';

type JobLoadingProps = Pick<CardDetailsProps, 'card' | 'onClose'> & {
  error?: string;
  onRetry?: () => void;
};

export const JobLoading = ({ card, onClose, error, onRetry }: JobLoadingProps) => (
  <JobSheet onClose={onClose}>
    <JobSummary card={card} onClose={onClose} />
    <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={!error}>
      {error ? (
        <div role="alert" className="space-y-2 px-5 py-5 max-mobile:px-4">
          <h3 className="font-semibold">Could not load job details</h3>
          <p className="text-sm break-words text-muted-foreground">{error}</p>
        </div>
      ) : (
        <div aria-hidden="true">
          <div className="detail-navigation px-5 max-mobile:px-4">
            <Skeleton className="h-[38px] w-full motion-reduce:animate-none" />
          </div>
          <div className="detail-tab-content px-5 py-5 max-mobile:px-4">
            <div className="detail-job space-y-6">
              <section className="space-y-3">
                <Skeleton className="mb-5 h-5 w-32 motion-reduce:animate-none" />
                <Skeleton className="h-3 w-full motion-reduce:animate-none" />
                <Skeleton className="h-3 w-11/12 motion-reduce:animate-none" />
                <Skeleton className="h-3 w-full motion-reduce:animate-none" />
                <Skeleton className="h-3 w-4/5 motion-reduce:animate-none" />
                <Skeleton className="h-3 w-2/3 motion-reduce:animate-none" />
              </section>
              <Skeleton className="h-12 w-full motion-reduce:animate-none" />
            </div>
          </div>
        </div>
      )}
    </div>
    <JobActionFooter
      hint={
        error ? (
          <p className="action-hint">Try again to open this job.</p>
        ) : (
          <output className="action-hint">Loading job details…</output>
        )
      }
    >
      {error ? <Button onClick={onRetry}>Retry</Button> : null}
    </JobActionFooter>
  </JobSheet>
);
