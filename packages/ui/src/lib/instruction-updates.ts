import type { InstructionUpdate, Snapshot } from '@pitchcrew/core';

export const instructionUpdateFor = (data: Snapshot, roleId: string) => {
  return data.instructionUpdates?.find((update) => update.roleId === roleId);
};

/** Updates the user has not answered yet, for roles that can still be edited. */
export const pendingInstructionUpdates = (data: Snapshot): InstructionUpdate[] => {
  return (data.instructionUpdates ?? []).filter(
    (update) =>
      !update.dismissed && data.roles.some((role) => role.id === update.roleId && !role.retiredAt),
  );
};

export const instructionUpdateExplanation = (update: InstructionUpdate): string => {
  switch (update.state) {
    case 'unedited':
      return 'You have not changed these instructions since an earlier default. Using the new default replaces them.';
    case 'customized':
      return 'You edited an earlier default. Compare before you decide. Nothing changes until you choose.';
    case 'unknown_base':
      return 'These instructions do not match any earlier default, so they count as your own. Compare before you decide.';
  }
};
