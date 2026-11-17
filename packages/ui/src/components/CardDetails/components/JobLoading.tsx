import type { CardDetailsProps } from '../types.ts';
import { JobSheet } from './JobSheet.tsx';
import { JobSummary } from './JobSummary.tsx';
import { JobActionFooter } from './JobActionFooter.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { Skeleton } from '@pitchcrew/design-system/skeleton';

type JobLoadingProps = Pick<CardDetailsProps, 'card' | 'onClose'> & {
  error?: string;
  onRetry?: () => void;
};

export const JobLoading = ({ card, onClose, error, onRetry }: JobLoadingProps) => (
  <JobSheet onClose={onClose}>
    <div className="job-details-reading">
      <JobSummary card={card} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={!error}>
        {error ? (
          <div role="alert" className="detail-tab-content space-y-2">
            <h3 className="font-semibold">Could not load job details</h3>
            <p className="text-sm break-words text-muted-foreground">{error}</p>
          </div>
        ) : (
          <div aria-hidden="true">
            <div className="detail-navigation">
              <Skeleton className="h-9 w-64 motion-reduce:animate-none" />
            </div>
            <div className="detail-tab-content">
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
    </div>
    <JobActionFooter
      dock={
        error
          ? {
              material: 'raised',
              tone: 'rose',
              line: 'Couldn’t open this job',
              detail: 'Try again to load its details.',
            }
          : {
              material: 'rest',
              line: 'Loading job details…',
              detail: 'You can close this while it loads.',
            }
      }
    >
      {error ? <Button onClick={onRetry}>Retry</Button> : null}
    </JobActionFooter>
  </JobSheet>
);
