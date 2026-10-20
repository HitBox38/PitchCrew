import type { ConnectorStatus, Role } from '@pitchcrew/core';
import { AccordionSection } from '@/components/ui/accordion/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
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
  return (
    <div className="account-agent-access">
      <p className="quiet">
        {enabled.length
          ? `Enabled for ${enabled.map((entry) => entry.role.name).join(', ')}.`
          : 'No agents have access yet.'}
      </p>
      <AccordionSection heading="Choose agents" contentClassName="pb-3">
        <p className="quiet mb-3">
          Open an agent, review its connected-service capabilities and save to apply. Connecting an
          account does not grant access automatically.
        </p>
        <div className="grid gap-1">
          {entries.map(({ role, enabled: allowed }) => (
            <div key={role.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 text-sm wrap-anywhere">
                {role.name}
                <span className="quiet ml-2">{allowed ? 'Access enabled' : 'Not enabled'}</span>
              </span>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Configure ${role.name} access to ${connector.id === 'github' ? 'GitHub' : 'Google'}`}
                onClick={() => setRoleId(role.id)}
              >
                Configure <ArrowUpRight size={14} aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      </AccordionSection>
    </div>
  );
};
