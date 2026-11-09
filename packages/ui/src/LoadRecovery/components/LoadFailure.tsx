import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { loadFailureCopy, technicalDetail } from '../helpers.ts';
import { ReloadAction } from './ReloadAction.tsx';

export interface LoadFailureProps {
  error: unknown;
  /** What failed, as a sentence subject: "This page", "Job details". */
  subject: string;
  /** Renders again; shown only when that can help (not for a file that failed to download). */
  onRetry: () => void;
  onClose?: () => void;
  reload?: () => void;
  /** Renders the title as a dialog title inside panels. */
  titleAs?: (title: string) => ReactNode;
}

/** The clay recovery card shared by failed pages and panels. */
export const LoadFailure = ({
  error,
  subject,
  onRetry,
  onClose,
  reload = () => window.location.reload(),
  titleAs,
}: LoadFailureProps) => {
  const copy = loadFailureCopy(error, subject);
  return (
    <section className="ui-card load-failure" role="alert">
      {titleAs ? titleAs(copy.title) : <h2 className="load-failure-title">{copy.title}</h2>}
      <p className="load-failure-body">{copy.body}</p>
      <div className="load-failure-actions">
        {copy.retryable ? (
          <Button onClick={onRetry}>Try again</Button>
        ) : (
          <ReloadAction reload={reload} primary />
        )}
        {onClose ? (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        ) : null}
        {copy.retryable ? <ReloadAction reload={reload} primary={false} /> : null}
      </div>
      <Collapsible className="load-failure-details">
        <CollapsibleTrigger className="load-failure-trigger">
          <ChevronRight size={12} aria-hidden="true" />
          Technical details
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SourceBlock label="Error details" value={technicalDetail(error)} />
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
};
