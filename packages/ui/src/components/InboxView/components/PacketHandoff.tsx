import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { keyedItems } from '@/lib/list-keys.ts';
import type { Approval, Snapshot } from '@pitchcrew/core';
import { packetHandoff } from '../handoff.ts';

const HandoffList = ({ heading, items }: { heading: string; items: string[] }) =>
  items.length ? (
    <section className="mail-handoff-list">
      <h4>{heading}</h4>
      <ul>
        {keyedItems(items, (item) => item).map(({ item, key }) => (
          <li key={key}>{item}</li>
        ))}
      </ul>
    </section>
  ) : null;

/** What the reviewing and drafting agents tell the user about this exact packet. */
export const PacketHandoff = ({ approval, data }: { approval: Approval; data: Snapshot }) => {
  const { reviewed, summary, reviewer, changes } = packetHandoff(approval, data);
  if (!reviewed && !changes.length) return null;
  return (
    <section className="mail-handoff" aria-label="Packet summary">
      {summary ? (
        <>
          <div className="mail-handoff-verdict">
            <RoleAvatar agentRole={reviewer.id} size="small" />
            <div>
              <h3>{reviewer.name}’s assessment</h3>
              <p>{summary.assessment}</p>
            </div>
          </div>
          <HandoffList heading="What to do next" items={summary.nextSteps} />
          <HandoffList heading="Worth knowing" items={summary.highlights} />
          <HandoffList heading="Gaps and limits" items={summary.limitations} />
        </>
      ) : reviewed ? (
        <p className="quiet">
          This packet was reviewed before agents wrote summaries. Open note.md for the Writer’s
          notes.
        </p>
      ) : null}
      <HandoffList heading="Changed in this draft" items={changes} />
    </section>
  );
};
