import type { InstructionUpdate } from '@pitchcrew/core';
import { InstructionUpdateView } from '@/components/InstructionUpdate/index.tsx';
import { UpdateActions } from '@/components/InstructionUpdate/components/UpdateActions.tsx';
import { useInstructionUpdate } from '@/components/InstructionUpdate/hooks/useInstructionUpdate.ts';
import type { RoleSettingsModel } from '@/components/RoleSettings/types.ts';
import { RoleSettingsForm } from './RoleSettingsForm.tsx';

/**
 * Opened to compare a default instruction update: the comparison leads the panel and its decision
 * owns the pinned footer. Once the user keeps theirs or edits from the new default, the ordinary
 * Save footer returns; adopting removes the update and the panel re-renders as plain settings.
 */
export const InstructionReviewForm = ({
  update,
  ...controller
}: RoleSettingsModel & { update: InstructionUpdate }) => {
  const model = useInstructionUpdate({ ...controller, update, initiallyExpanded: true });
  const deciding = model.expanded && model.previous === null;
  return (
    <RoleSettingsForm
      {...controller}
      lead={<InstructionUpdateView {...model} inlineActions={!deciding} />}
      footer={deciding ? <UpdateActions {...model} footer /> : undefined}
    />
  );
};
