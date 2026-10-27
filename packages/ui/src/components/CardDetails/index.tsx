import { useCardSource } from './hooks/useCardSource.ts';
import { useCardDetails } from './hooks/useCardDetails.ts';
import { JobSheet } from './components/JobSheet.tsx';
import { JobSummary } from './components/JobSummary.tsx';
import { JobTabs } from './components/JobTabs.tsx';
import { JobActions } from './components/JobActions.tsx';
import { JobLoading } from './components/JobLoading.tsx';
import type { CardDetailsProps } from './types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';

export const CardDetails = (props: CardDetailsProps) => {
  const source = useCardSource(props.card, props.data.workspace === true);
  if (!source.ready)
    return (
      <JobLoading
        card={props.card}
        onClose={props.onClose}
        error={source.error}
        onRetry={source.retry}
      />
    );
  return (
    <CardDetailsContent
      {...props}
      card={source.card}
      sourceError={source.error}
      retrySource={source.retry}
    />
  );
};
const CardDetailsContent = (
  props: CardDetailsProps & { sourceError: string; retrySource: () => void },
) => {
  const model = useCardDetails(props);
  return (
    <JobSheet onClose={model.onClose}>
      <JobSummary {...model} />
      {props.sourceError ? (
        <div role="alert" className="px-5">
          <p>{props.sourceError}</p>
          <Button onClick={props.retrySource}>Retry</Button>
        </div>
      ) : null}
      <JobTabs {...model} />
      <JobActions {...model} />
      <DiscardChanges guard={model.guard} />
    </JobSheet>
  );
};
