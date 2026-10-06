import type { InstructionUpdateModel } from '../types.ts';
import { instructionUpdateExplanation, instructionUpdateTitle } from '@/lib/instruction-updates.ts';
import { Sparkles } from 'lucide-react';

export function UpdateSummary({ role, update, tools }: InstructionUpdateModel) {
  return (
    <>
      <h3 id={`${role.id}-instruction-update-heading`} className="flex items-center gap-2">
        <Sparkles size={16} aria-hidden="true" />
        {instructionUpdateTitle}
      </h3>
      <p className="quiet">{instructionUpdateExplanation(update)}</p>
      <h4 className="instruction-update-label">What changed in the default</h4>
      <ul className="instruction-update-changes">
        {update.changes.map((change) => (
          <li key={change.revision}>
            <time dateTime={change.date}>{change.date}</time> {change.summary}
          </li>
        ))}
      </ul>
      {tools.length ? (
        <p className="quiet">
          Your tool settings differ from this default for: {tools.join('; ')}. This update changes
          instructions only. Tools stay as they are.
        </p>
      ) : null}
    </>
  );
}
