import type { BackgroundServiceInfo } from '@pitchcrew/core';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible/index.tsx';
import { ChevronDown } from 'lucide-react';
import { serviceCommands } from '../helpers.ts';
import { ServiceCommand } from './ServiceCommand.tsx';

/** Status, logs and removal stay CLI commands, kept in a disclosure below the service row. */
export const ServiceCommands = ({ info }: { info: BackgroundServiceInfo }) => {
  const commands = serviceCommands(info);
  if (!commands.length) return null;
  return (
    <Collapsible className="settings-list-row settings-disclosure">
      <CollapsibleTrigger className="settings-disclosure-trigger">
        <ChevronDown size={16} aria-hidden="true" /> Commands and logs
      </CollapsibleTrigger>
      <CollapsibleContent>
        {commands.map((command) => (
          <ServiceCommand command={command} key={command} />
        ))}
        <p className="quiet">
          Run these in <code className="wrap-anywhere">{info.repository}</code>. The service never
          needs administrator rights.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
};
