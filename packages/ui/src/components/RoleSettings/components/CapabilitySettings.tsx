import type { RoleSettingsModel } from '@/components/RoleSettings/types.ts';
import { ToolGroups } from './ToolGroups.tsx';

/** Tools: each group a disclosure with its enabled count; changes apply on Save settings. */
export const CapabilitySettings = ({
  role,
  data,
  capabilities,
  setCapabilities,
}: RoleSettingsModel) => {
  return (
    <section
      className="agent-panel-section"
      id="agent-tools"
      aria-labelledby={`${role.id}-capabilities-heading`}
    >
      <h3 id={`${role.id}-capabilities-heading`}>Tools</h3>
      <p className="agent-panel-fact">
        Chat, your local Profile and assigned skills need no extra access. Exports, browser actions
        and submissions still ask you first.
      </p>
      <ToolGroups capabilities={capabilities} data={data} onChange={setCapabilities} />
    </section>
  );
};
