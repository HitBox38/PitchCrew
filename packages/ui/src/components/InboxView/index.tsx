import { Link } from '@tanstack/react-router';
import { HistoryList } from './components/HistoryList.tsx';
import { HistorySheet } from './components/HistorySheet.tsx';
import { useInboxView } from './hooks/useInboxView.ts';
import type { InboxViewProps } from './types.ts';

/** Decisions history: past packet and browser decisions beside the one being read. */
export const InboxView = (props: InboxViewProps) => {
  const model = useInboxView(props);
  if (!model.total)
    return (
      <div className="ui-empty decide-empty">
        <span>No packet or browser decisions yet</span>
        <Link to="/inbox" search={{}} activeOptions={{ exact: true }}>
          Back to Decisions
        </Link>
      </div>
    );
  return (
    <section
      className="decision-history"
      aria-label="Decision history"
      data-reading={model.selectedRequest ? '' : undefined}
    >
      <HistoryList {...model} />
      {model.selectedRequest ? <HistorySheet {...model} request={model.selectedRequest} /> : null}
    </section>
  );
};
