import type { InstructionUpdateModel } from '../types.ts';
import { Sparkles } from 'lucide-react';

/** The update's heading and one sentence on what the newest default changes. */
export const UpdateSummary = ({ role, update }: InstructionUpdateModel) => {
  const latest = update.changes.at(-1);
  return (
    <>
      <div className="instruction-update-heading">
        <span className="ui-chip" data-tone="plum">
          <Sparkles size={12} aria-hidden="true" />
          Update
        </span>
        <h3 id={`${role.id}-instruction-update-heading`}>New default instructions</h3>
        {latest ? <time dateTime={latest.date}>{latest.date}</time> : null}
      </div>
      {latest ? <p className="instruction-update-notice">{latest.summary}</p> : null}
    </>
  );
};
