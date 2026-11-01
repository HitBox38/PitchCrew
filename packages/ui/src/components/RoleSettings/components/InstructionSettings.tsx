import type { RoleSettingsModel } from '@/components/RoleSettings/types.ts';
import { Textarea } from '@pitchcrew/design-system/textarea';
import { RoleInstructionUpdate } from './RoleInstructionUpdate.tsx';

/** Instructions, with an available default update compared beside them unless it leads the panel. */
export const InstructionSettings = (props: RoleSettingsModel) => {
  const { role, instructions, setInstructions, reviewInstructions } = props;
  return (
    <section
      className="agent-panel-section"
      id="agent-instructions"
      aria-labelledby={`${role.id}-instructions-heading`}
    >
      <h3 id={`${role.id}-instructions-heading`}>
        <label htmlFor={`${role.id}-instructions`}>Instructions</label>
      </h3>
      {!reviewInstructions ? <RoleInstructionUpdate {...props} /> : null}
      <Textarea
        id={`${role.id}-instructions`}
        rows={12}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        maxLength={12000}
      />
      <p className="optional">{instructions.length.toLocaleString()} / 12,000 characters</p>
    </section>
  );
};
