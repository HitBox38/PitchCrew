import type { Approval } from '@pitchcrew/core';
import { exportChoice } from '@/Decisions/helpers.ts';

/** The export formats and layout frozen into this approval, shown as a read-only choice. */
export const PacketExport = ({ approval }: { approval: Approval }) => {
  const { formats, layout } = exportChoice(approval);
  return (
    <section className="packet-section" aria-label="Export">
      <h3 className="packet-section-heading">
        Export as{' '}
        <span>
          {approval.status === 'pending'
            ? 'Part of the approval. To change it, reject and ask again from the job.'
            : 'Fixed by this approval.'}
        </span>
      </h3>
      <div className="packet-export">
        <ul className="packet-export-choice" aria-label="Formats">
          {formats.map((format) => (
            <li key={format}>{format}</li>
          ))}
        </ul>
        {layout ? (
          <ul className="packet-export-choice" aria-label="Layout">
            <li>{layout}</li>
          </ul>
        ) : null}
      </div>
    </section>
  );
};
