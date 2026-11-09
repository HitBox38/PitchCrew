import type { ErrorComponentProps } from '@tanstack/react-router';
import { retryFailedLoads } from '@/lib/retryable-lazy.ts';
import { LoadFailure } from './LoadFailure.tsx';

/**
 * Replaces TanStack's raw "Something went wrong!" page. Child routes render it inside the root
 * App's outlet, so the sidebar, app bar and unsent drafts stay; only the page area changes.
 */
export const RouteLoadError = ({ error, reset }: ErrorComponentProps) => (
  <div className="load-failure-page">
    <LoadFailure
      error={error}
      subject="This page"
      onRetry={() => {
        retryFailedLoads();
        reset();
      }}
    />
  </div>
);
