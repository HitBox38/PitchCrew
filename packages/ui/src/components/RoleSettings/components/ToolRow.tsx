import { useId } from 'react';
import { capabilityLabels } from '@/agent-capabilities.ts';
import { toolHelp } from '@/AgentCreation/constants.ts';
import { Switch } from '@pitchcrew/design-system/switch';

type Tool = keyof typeof capabilityLabels;

/** One tool: its name, what it allows, and why it is not active yet when something is missing. */
export const ToolRow = ({
  tool,
  checked,
  blocker,
  onChange,
}: {
  tool: Tool;
  checked: boolean;
  blocker?: string;
  onChange: (checked: boolean) => void;
}) => {
  const id = useId();
  return (
    <div className="agent-tool">
      <span className="agent-tool-copy">
        <label htmlFor={id}>{capabilityLabels[tool]}</label>
        <span id={`${id}-help`}>{toolHelp[tool]}</span>
        {blocker ? (
          <span className="agent-tool-blocker" id={`${id}-blocker`}>
            Not active yet. {blocker}
          </span>
        ) : null}
      </span>
      <Switch
        id={id}
        aria-label={capabilityLabels[tool]}
        aria-describedby={blocker ? `${id}-help ${id}-blocker` : `${id}-help`}
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  );
};
