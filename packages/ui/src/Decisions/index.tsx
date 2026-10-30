import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowLeft, Check, History } from 'lucide-react';
import type { Snapshot } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import { WorkspaceHeaderActions } from '@/App/components/WorkspacePage.tsx';
import { InboxView } from '@/components/InboxView/index.tsx';
import { Button } from '@/components/ui/button/index.tsx';
import { decisions } from '@/ClayInterface/signals.ts';
import { DecisionPager } from './components/DecisionPager.tsx';
import { DecisionRail } from './components/DecisionRail.tsx';
import { DecisionSheet } from './components/DecisionSheet.tsx';

type DecisionsViewProps = {
  data: Snapshot;
  action: Action;
  working: boolean;
  openCard: (id: string, section?: 'application') => void;
};

/** One decision at a time; resolved decisions leave the list and the next one takes focus. */
export const DecisionsView = ({ data, action, working, openCard }: DecisionsViewProps) => {
  const { decision: wanted, view, entry } = useSearch({ from: '/inbox' });
  const navigate = useNavigate({ from: '/inbox' });
  const items = decisions(data);
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === wanted),
  );
  const current = items[index];
  const select = (id: string) => void navigate({ search: { decision: id }, replace: true });
  if (view === 'history')
    return (
      <>
        <WorkspaceHeaderActions>
          <Button variant="secondary" onClick={() => void navigate({ search: {} })}>
            <ArrowLeft size={15} />
            Decisions{items.length ? ` (${items.length})` : ''}
          </Button>
        </WorkspaceHeaderActions>
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
      </>
    );
  return (
    <section className="clay-decide" aria-label="Decisions">
      <WorkspaceHeaderActions>
        {items.length > 1 ? <DecisionPager items={items} index={index} select={select} /> : null}
        <Button variant="secondary" onClick={() => void navigate({ search: { view: 'history' } })}>
          <History size={15} />
          Inbox history
        </Button>
      </WorkspaceHeaderActions>
      {current ? (
        <>
          <DecisionSheet
            key={current.id}
            decision={current}
            data={data}
            action={action}
            working={working}
            openCard={openCard}
          />
          <DecisionRail decision={current} items={items} data={data} select={select} />
        </>
      ) : (
        <p className="clay-decide-clear">
          <Check aria-hidden="true" size={18} />
          Nothing needs you. Packets, browser requests, questions and briefs wait here when the crew
          needs a decision.
        </p>
      )}
    </section>
  );
};
