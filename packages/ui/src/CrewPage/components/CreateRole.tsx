import { useState } from 'react';
import type { Role, Snapshot } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { RoleSettings } from '@/components/RoleSettings/index.tsx';
import { capabilityDefaults } from '@/agent-capabilities.ts';
const draft: Role = {
  id: '',
  name: '',
  description: '',
  runtime: 'demo',
  model: '',
  enabled: true,
  instructions: '',
  workflow: 'chat',
  capabilities: {
    ...capabilityDefaults,
    messageAgents: false,
    invokeAgents: false,
    manageWorkflow: false,
    manageRoutines: false,
  },
};
export function CreateRole({
  data,
  action,
  working,
}: {
  data: Snapshot;
  action: Action;
  working: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      <Button onClick={() => setOpen(true)}>Create role</Button>
      {open ? (
        <RoleSettings
          creating
          role={draft}
          data={data}
          action={action}
          working={working}
          onClose={() => setOpen(false)}
          onManageSkills={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
