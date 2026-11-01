import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import type { InstructionUpdate, Snapshot } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { pendingProposals } from '@/CrewPage/helpers.ts';
import { PenLine, SlidersHorizontal, Sparkles } from 'lucide-react';

/** Default updates and agent proposals that change nothing until the user decides. */
export const CrewWaiting = ({
  data,
  updates,
  onReview,
}: {
  data: Snapshot;
  updates: InstructionUpdate[];
  onReview: (id: string) => void;
}) => {
  const { updates: updatesOnly } = useSearch({ from: '/crew' });
  const navigate = useNavigate({ from: '/crew' });
  const proposals = pendingProposals(data);
  const total = updates.length + proposals.length;
  if (!total && !updatesOnly) return null;
  const name = (id: string) => data.roles.find((role) => role.id === id)?.name ?? id;
  return (
    <section
      className="ui-section crew-waiting"
      id="crew-waiting"
      aria-labelledby="crew-waiting-heading"
      tabIndex={-1}
    >
      <h2 className="ui-section-heading" id="crew-waiting-heading">
        Waiting on you <span className="ui-count">{total}</span>
        <Button
          className="button small ui-section-action"
          aria-pressed={Boolean(updatesOnly)}
          onClick={() =>
            void navigate({
              search: (previous) => ({ ...previous, updates: updatesOnly ? undefined : true }),
            })
          }
        >
          Updates only
        </Button>
      </h2>
      {total ? (
        <ul className="crew-waiting-list" data-layout={total > 2 ? 'list' : 'pair'}>
          {updates.map((update) => (
            <li key={`update:${update.roleId}`} className="crew-decision">
              <span className="crew-decision-kind" aria-hidden="true">
                <Sparkles size={15} />
              </span>
              <span className="crew-decision-copy">
                <strong>{name(update.roleId)} has new default instructions</strong>
                <span>{update.changes.at(-1)?.summary ?? 'Compare before anything changes.'}</span>
              </span>
              <Button className="button small" onClick={() => onReview(update.roleId)}>
                Compare<span className="sr-only"> {name(update.roleId)}’s instructions</span>
              </Button>
            </li>
          ))}
          {proposals.map((proposal) => (
            <li key={`${proposal.kind}:${proposal.id}`} className="crew-decision">
              <span className="crew-decision-kind" aria-hidden="true">
                {proposal.kind === 'skill' ? (
                  <PenLine size={15} />
                ) : (
                  <SlidersHorizontal size={15} />
                )}
              </span>
              <span className="crew-decision-copy">
                <strong>
                  {proposal.kind === 'skill'
                    ? `${name(proposal.roleId)} suggests a skill: ${proposal.targetId}`
                    : proposal.roleId === proposal.targetId
                      ? `${name(proposal.roleId)} suggests a change to its role`
                      : `${name(proposal.roleId)} suggests a change to ${name(proposal.targetId)}`}
                </strong>
                <span>“{proposal.reason}”</span>
              </span>
              <Button
                className="button small"
                nativeButton={false}
                render={<Link to="/chat/$thread" params={{ thread: proposal.thread }} />}
              >
                Review<span className="sr-only"> in chat</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};
