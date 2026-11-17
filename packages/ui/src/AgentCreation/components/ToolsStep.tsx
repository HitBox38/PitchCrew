import { ToolGroups } from '@/components/RoleSettings/components/ToolGroups.tsx';
import { newAgentCapabilities, toolGroups } from '../constants.ts';
import type { StepProps } from '../types.ts';

/** Least access first: every tool starts off except what the user switches on here. */
export const ToolsStep = ({ draft, changeRole, data }: StepProps) => {
  const capabilities = { ...newAgentCapabilities, ...draft.role.capabilities };
  return (
    <div className="agent-wizard-step">
      <p className="optional">
        It can already chat, read your local Profile and use its skills. Exports and final
        submissions always ask you first; browser actions follow its browser permissions, Supervised
        by default.
      </p>
      <ToolGroups
        capabilities={capabilities}
        data={data}
        defaultOpen={toolGroups.map((group) => group.title)}
        onChange={(next) => changeRole({ capabilities: next })}
      />
    </div>
  );
};
