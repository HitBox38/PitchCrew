import type { BackgroundServiceInfo } from '@pitchcrew/core';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { ChevronDown } from 'lucide-react';
import { serviceCommands, serviceDiagnostics } from '../helpers.ts';
import { ServiceCommand } from './ServiceCommand.tsx';

/** Status, logs and removal stay CLI commands, kept in a disclosure below the service row. */
export const ServiceCommands = ({ info }: { info: BackgroundServiceInfo }) => {
  const commands = serviceCommands(info);
  if (!info.status.platform) return null;
  const canInstall = !info.status.installed || !info.matches;
  return (
    <Collapsible className="settings-list-row settings-disclosure">
      <CollapsibleTrigger className="settings-disclosure-trigger">
        <ChevronDown size={16} aria-hidden="true" />
        {commands.length ? 'Commands and logs' : 'Installation details'}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {serviceDiagnostics(info).map((note) => (
          <p key={note} className="quiet">
            {note}
          </p>
        ))}
        {canInstall ? (
          <p className="quiet">
            Pitchcrew builds the production UI if needed and installs the service without
            administrator rights.
          </p>
        ) : null}
        {commands.map((command) => (
          <ServiceCommand command={command} key={command} />
        ))}
        {commands.length ? (
          <p className="quiet">
            Run these in <code className="wrap-anywhere">{info.repository}</code>. The service never
            needs administrator rights.
          </p>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
};
