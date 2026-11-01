import { AlertTriangle, Check, PenLine } from 'lucide-react';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { keyedItems } from '@/lib/list-keys.ts';
import { timeAgo } from '@/lib/time.ts';
import type { PacketCheck } from '@/Decisions/helpers.ts';
import type { PacketHandoffData } from '../handoff.ts';
import { VerdictNotes } from './VerdictNotes.tsx';

const Checks = ({ checks }: { checks: PacketCheck[] }) =>
  checks.length ? (
    <ul className="packet-checks" aria-label="Checks on these files">
      {checks.map((check) => (
        <li key={check.label} data-ok={check.ok ? '' : undefined}>
          {check.ok ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <AlertTriangle size={14} aria-hidden="true" />
          )}
          {check.label}
        </li>
      ))}
    </ul>
  ) : null;

/** The Reviewer's assessment of this exact packet and the Writer's notes on what changed. */
export const HandoffSummary = ({
  handoff,
  checks = [],
}: {
  handoff: PacketHandoffData;
  checks?: PacketCheck[];
}) => {
  const { reviewed, reviewedAt, summary, reviewer, changes } = handoff;
  if (!reviewed && !changes.length && !checks.length) return null;
  return (
    <>
      {summary ? (
        <section className="packet-verdict" aria-label="Packet summary">
          <RoleAvatar agentRole={reviewer.id} size="small" />
          <div className="packet-verdict-copy">
            <h3 className="packet-verdict-title">
              <span>{reviewer.name}’s assessment</span>
              {reviewedAt ? <time dateTime={reviewedAt}>{timeAgo(reviewedAt)}</time> : null}
            </h3>
            <p className="packet-verdict-quote">{summary.assessment}</p>
            <Checks checks={checks} />
            <VerdictNotes summary={summary} />
          </div>
        </section>
      ) : reviewed || checks.length ? (
        <section className="packet-verdict" aria-label="Packet summary">
          <div className="packet-verdict-copy">
            {reviewed ? (
              <p className="packet-verdict-quote">
                No summary was written for this review. Open note.md for the Writer’s notes.
              </p>
            ) : null}
            <Checks checks={checks} />
          </div>
        </section>
      ) : null}
      {changes.length ? (
        <section className="packet-section" aria-label="Changed in this draft">
          <h3 className="packet-section-heading">
            Since the last draft <span>What the Writer changed</span>
          </h3>
          <ul className="packet-changes">
            {keyedItems(changes, (item) => item).map(({ item, key }) => (
              <li key={key}>
                <PenLine size={14} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
};
