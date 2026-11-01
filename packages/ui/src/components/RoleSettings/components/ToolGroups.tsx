import type { Snapshot } from '@pitchcrew/core';
import type { capabilityDefaults } from '@/agent-capabilities.ts';
import { toolGroups } from '@/AgentCreation/constants.ts';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@pitchcrew/design-system/accordion';
import { groupSummary, toolBlocker } from '../tools.ts';
import { ToolRow } from './ToolRow.tsx';

type Capabilities = typeof capabilityDefaults;

/** Tool groups as independent disclosures, each summarising how many of its tools are on. */
export const ToolGroups = ({
  capabilities,
  data,
  onChange,
  defaultOpen = [],
}: {
  capabilities: Capabilities;
  data: Pick<Snapshot, 'connectors'>;
  onChange: (next: Capabilities) => void;
  defaultOpen?: string[];
}) => {
  return (
    <Accordion multiple defaultValue={defaultOpen} className="agent-tool-groups">
      {toolGroups.map((group) => (
        <AccordionItem key={group.title} value={group.title} className="agent-tool-group">
          <AccordionTrigger className="agent-tool-group-trigger">
            <span>{group.title}</span>
            <span className="agent-tool-group-count">{groupSummary(group.keys, capabilities)}</span>
          </AccordionTrigger>
          <AccordionContent keepMounted className="agent-tool-group-body">
            {group.keys.map((key) => (
              <ToolRow
                key={key}
                tool={key}
                checked={capabilities[key]}
                blocker={toolBlocker(key, capabilities, data)}
                onChange={(checked) => onChange({ ...capabilities, [key]: checked })}
              />
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};
