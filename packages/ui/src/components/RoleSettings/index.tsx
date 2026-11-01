import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { useRoleSettings } from '@/components/RoleSettings/hooks/useRoleSettings.ts';
import type { RoleSettingsProps } from '@/components/RoleSettings/types.ts';
import { instructionUpdateFor } from '@/lib/instruction-updates.ts';
import { InstructionReviewForm } from './components/InstructionReviewForm.tsx';
import { RoleSettingsForm } from './components/RoleSettingsForm.tsx';
import { RoleSettingsHeading } from './components/RoleSettingsHeading.tsx';
import { RoleSettingsSurface } from './components/RoleSettingsSurface.tsx';

/**
 * The agent panel: identity, runtime, instructions (with any default update), tools, browser,
 * skills, memory and retirement, saved together by one footer action. Opened to review a default
 * update, the comparison leads and its decision holds the footer until resolved.
 */
export const RoleSettings = (props: RoleSettingsProps) => {
  const controller = useRoleSettings(props);
  const { role, data, creating } = controller;
  const update =
    props.reviewInstructions && !creating && !role.retiredAt
      ? instructionUpdateFor(data, role.id)
      : undefined;
  return (
    <>
      <RoleSettingsSurface docked={props.docked} onClose={controller.onClose}>
        <RoleSettingsHeading {...controller} />
        {update ? (
          <InstructionReviewForm key={update.revision} {...controller} update={update} />
        ) : (
          <RoleSettingsForm {...controller} />
        )}
      </RoleSettingsSurface>
      <DiscardChanges guard={controller.guard} />
    </>
  );
};
