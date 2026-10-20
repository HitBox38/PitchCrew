import { useCardSource } from './hooks/useCardSource.ts';
import { useCardDetails } from './hooks/useCardDetails.ts';
import { JobSheet } from './components/JobSheet.tsx';
import { JobSummary } from './components/JobSummary.tsx';
import { JobTabs } from './components/JobTabs.tsx';
import { JobActions } from './components/JobActions.tsx';
import type { CardDetailsProps } from './types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';

export function CardDetails(props: CardDetailsProps) {
  const source = useCardSource(props.card, props.data.workspace === true);
  if (!source.ready)
    return (
      <JobSheet onClose={props.onClose}>
        <div className="p-5">
          <p>{source.error || 'Opening job…'}</p>
          {source.error ? <Button onClick={source.retry}>Retry</Button> : null}
          <Button onClick={props.onClose}>Close</Button>
        </div>
      </JobSheet>
    );
  return (
    <CardDetailsContent
      {...props}
      card={source.card}
      sourceError={source.error}
      retrySource={source.retry}
    />
  );
}
function CardDetailsContent(
  props: CardDetailsProps & { sourceError: string; retrySource: () => void },
) {
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
}
