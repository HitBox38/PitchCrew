import { InstructionUpdate } from '@/components/InstructionUpdate/index.tsx';
import type { RoleSettingsModel } from '@/components/RoleSettings/types.ts';
import { instructionUpdateFor } from '@/lib/instruction-updates.ts';

export function RoleInstructionUpdate({
  creating,
  role,
  data,
  action,
  working,
  instructions,
  setInstructions,
  setDefaultInstructionRevision,
}: RoleSettingsModel) {
  const update = creating ? undefined : instructionUpdateFor(data, role.id);
  if (!update || role.retiredAt) return null;
  return (
    <InstructionUpdate
      key={update.revision}
      role={role}
      update={update}
      action={action}
      working={working}
      instructions={instructions}
      setInstructions={setInstructions}
      setDefaultInstructionRevision={setDefaultInstructionRevision}
    />
  );
}
