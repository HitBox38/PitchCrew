import type { ConnectorStatus, Role } from '@pitchcrew/core';
import { AccordionSection } from '@pitchcrew/design-system/accordion';
import { Button } from '@pitchcrew/design-system/button';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { ArrowUpRight } from 'lucide-react';
import { connectorAgents } from '../helpers.ts';

export const AccountAgentAccess = ({
  connector,
  roles,
}: {
  connector: ConnectorStatus;
  roles: Role[];
}) => {
  const setRoleId = useWorkspaceStore((store) => store.setRoleId);
  const entries = connectorAgents(roles, connector);
  const enabled = entries.filter((entry) => entry.enabled);
  const service = connector.id === 'github' ? 'GitHub' : 'Google';
  return (
    <div className="settings-agent-access">
      <p className="quiet">
        {enabled.length
          ? `Enabled for ${enabled.map((entry) => entry.role.name).join(', ')}.`
          : 'No agents have access yet.'}
      </p>
      <AccordionSection heading="Choose agents" contentClassName="settings-agent-choices">
        <p className="quiet">Opens the agent’s settings. Save there to change its access.</p>
        {entries.map(({ role, enabled: allowed }) => (
          <div key={role.id} className="settings-agent-choice">
            <span className="min-w-0 wrap-anywhere">
              {role.name}
              <span className="ui-row-meta"> · {allowed ? 'Access enabled' : 'Not enabled'}</span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Configure ${role.name} access to ${service}`}
              onClick={() => setRoleId(role.id)}
            >
              Configure <ArrowUpRight size={14} aria-hidden="true" />
            </Button>
          </div>
        ))}
      </AccordionSection>
    </div>
  );
};
