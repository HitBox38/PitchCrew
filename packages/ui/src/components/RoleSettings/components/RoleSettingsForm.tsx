import type { ReactNode } from 'react';
import { AgentMemory } from '@/AgentMemory/index.tsx';
import type { RoleSettingsModel } from '@/components/RoleSettings/types.ts';
import { RuntimeRecommendation } from '@/RuntimeRecommendation/index.tsx';
import { defaultRoleIds } from '@pitchcrew/core/states';
import { BrowserSettings } from './BrowserSettings.tsx';
import { CapabilitySettings } from './CapabilitySettings.tsx';
import { IdentitySettings } from './IdentitySettings.tsx';
import { InstructionSettings } from './InstructionSettings.tsx';
import { RoleRetirement } from './RoleRetirement.tsx';
import { RoleSettingsFooter } from './RoleSettingsFooter.tsx';
import { RoleSkills } from './RoleSkills.tsx';
import { RuntimeSettings } from './RuntimeSettings.tsx';
import { SectionJump } from './SectionJump.tsx';

/**
 * The panel's scrolling sections and pinned footer. A pending decision (a default instruction
 * comparison) can lead the sections and replace the Save footer until it is resolved.
 */
export const RoleSettingsForm = ({
  lead,
  footer,
  ...controller
}: RoleSettingsModel & { lead?: ReactNode; footer?: ReactNode }) => {
  const seeded = !controller.creating && defaultRoleIds.some((id) => id === controller.role.id);
  return (
    <form
      className="form agent-panel-form"
      // While a decision owns the footer there is no Save; Enter must not save settings either.
      onSubmit={(e) => (footer ? e.preventDefault() : void controller.save(e))}
    >
      <div className="agent-panel-body">
        <SectionJump {...controller} />
        {lead}
        <IdentitySettings {...controller} />
        <RuntimeSettings {...controller} stacked hideEnabled={!controller.creating}>
          {seeded ? (
            <RuntimeRecommendation
              key={controller.role.id}
              roleId={controller.role.id}
              disabled={controller.working}
              configuration={{
                runtime: controller.runtime,
                model: controller.model,
                reasoning: controller.reasoning,
              }}
              onApply={(configuration) => {
                controller.setRuntime(configuration.runtime);
                controller.setModel(configuration.model);
                controller.setReasoning(configuration.reasoning ?? null);
              }}
            />
          ) : null}
        </RuntimeSettings>
        <InstructionSettings {...controller} />
        <CapabilitySettings {...controller} />
        <BrowserSettings {...controller} />
        {!controller.creating ? (
          <>
            <RoleSkills {...controller} />
            <AgentMemory roleId={controller.role.id} />
          </>
        ) : null}
        <RoleRetirement {...controller} />
      </div>
      {footer ?? <RoleSettingsFooter {...controller} />}
    </form>
  );
};
