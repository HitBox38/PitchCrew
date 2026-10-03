import type { JobActionsProps } from '@/components/CardDetails/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ArrowRight, Check, LoaderCircle, Play, ShieldCheck } from 'lucide-react';

export function JobActions({
  run,
  act,
  runRole,
  working,
  card,
  exported,
  onInbox,
}: JobActionsProps) {
  return (
    <div className="detail-actions">
      {run ? (
        <>
          <span className="running-note">
            <LoaderCircle size={16} className="spin" />
            {run.message}
          </span>
          <Button className="button" onClick={() => act(`/runs/${run.id}/cancel`)}>
            Cancel run
          </Button>
        </>
      ) : (
        <>
          {runRole ? (
            <Button
              disabled={working}
              className="button primary"
              onClick={() =>
                act(
                  `/cards/${card.id}/run`,
                  { roleId: runRole },
                  `${runRole[0].toUpperCase() + runRole.slice(1)} started`,
                )
              }
            >
              <Play size={15} />
              {card.state === 'lead'
                ? 'Evaluate fit'
                : ['shortlisted', 'changes_requested'].includes(card.state)
                  ? 'Draft application'
                  : 'Review packet'}
            </Button>
          ) : null}
          {card.state === 'lead' ? (
            <Button
              disabled={working}
              className="button"
              onClick={() => act(`/cards/${card.id}/move`, { state: 'shortlisted' }, 'Shortlisted')}
            >
              Shortlist <ArrowRight size={15} />
            </Button>
          ) : null}
          {card.state === 'agreed' ? (
            <Button
              disabled={working}
              className="button primary"
              onClick={() =>
                act(
                  `/cards/${card.id}/approval`,
                  undefined,
                  'Approval requested; it’s in your inbox',
                )
              }
            >
              <ShieldCheck size={15} /> Request export approval
            </Button>
          ) : null}
          {card.state === 'awaiting_approval' && !exported ? (
            <Button className="button primary" onClick={onInbox}>
              <ShieldCheck size={15} /> Open approval inbox
            </Button>
          ) : null}
          {card.state === 'awaiting_approval' && exported ? (
            <Button
              disabled={working}
              className="button primary"
              onClick={() =>
                act(
                  `/cards/${card.id}/move`,
                  { state: 'submitted' },
                  'Recorded your manual submission',
                )
              }
            >
              <Check size={15} /> Record manual submission
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
