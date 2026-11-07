import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import type { Snapshot } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import { WorkspaceHeaderFact, WorkspaceHeaderSegment } from '@/App/components/WorkspacePage.tsx';
import { InboxView } from '@/components/InboxView/index.tsx';
import { approvalRequests } from '@/components/InboxView/helpers.ts';
import { decisions } from '@/ClayInterface/signals.ts';
import { DecisionPager } from './components/DecisionPager.tsx';
import { DecisionPeek } from './components/DecisionPeek.tsx';
import { DecisionSheet } from './components/DecisionSheet.tsx';
import { DecisionsSegment } from './components/DecisionsSegment.tsx';
import { useRef } from 'react';
import { useDecisionResolutionFocus } from './hooks/useDecisionResolutionFocus.ts';
import { QuestionRecoveries } from './components/QuestionRecoveries.tsx';

type DecisionsViewProps = {
  data: Snapshot;
  action: Action;
  working: boolean;
  openCard: (id: string, section?: 'application') => void;
};

/** One decision at a time; resolved decisions leave the list and the next one takes focus. */
export const DecisionsView = ({ data, action, working, openCard }: DecisionsViewProps) => {
  const focusRoot = useRef<HTMLElement>(null);
  const { decision: wanted, view, entry } = useSearch({ from: '/inbox' });
  const navigate = useNavigate({ from: '/inbox' });
  const items = decisions(data);
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === wanted),
  );
  const current = items[index];
  const onResolved = useDecisionResolutionFocus(focusRoot, current?.id);
  const history = view === 'history';
  const past = history ? approvalRequests(data, 'history').length : 0;
  const select = (id: string) => void navigate({ search: { decision: id }, replace: true });
  return (
    <section
      ref={focusRoot}
      className="decide"
      data-view={history ? 'history' : 'pending'}
      aria-label="Decisions"
    >
      {!history && items.length ? (
        <WorkspaceHeaderFact>
          <DecisionPager items={items} index={index} select={select} />
        </WorkspaceHeaderFact>
      ) : null}
      {history ? (
        <WorkspaceHeaderFact>
          {past} past decision{past === 1 ? '' : 's'}
        </WorkspaceHeaderFact>
      ) : null}
      <WorkspaceHeaderSegment>
        <DecisionsSegment history={history} count={items.length} />
      </WorkspaceHeaderSegment>
      <QuestionRecoveries questions={data.userInputs} />
      {history ? (
        <InboxView
          data={data}
          action={action}
          working={working}
          onOpen={openCard}
          selected={entry}
          select={(key) =>
            void navigate({ search: { view: 'history', entry: key ?? undefined }, replace: !key })
          }
        />
      ) : current ? (
        <div className="decide-stack">
          <DecisionSheet
            key={current.id}
            decision={current}
            data={data}
            action={action}
            working={working}
            openCard={openCard}
            onResolved={onResolved}
          />
          <DecisionPeek
            next={items.length > 1 ? items[(index + 1) % items.length] : undefined}
            data={data}
            select={select}
          />
        </div>
      ) : (
        <div className="ui-empty decide-empty">
          <span tabIndex={-1} data-decision-focus="">
            No decisions waiting
          </span>
          <Link to="/inbox" search={{ view: 'history' }}>
            History
          </Link>
          <Link to="/">Board</Link>
        </div>
      )}
    </section>
  );
};
