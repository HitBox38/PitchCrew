import { useState } from 'react';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import { MemoryNotebook } from '@/ChatView/components/MemoryNotebook.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { BookOpen } from 'lucide-react';
import type { Snapshot } from '@pitchcrew/core';
export function AgentMemory({ roleId }: { roleId: string }) {
  const [open, setOpen] = useState(false);
  const data = useWorkspaceStore((state) => state.data);
  return (
    <section className="role-settings-section">
      <h3>Saved memory</h3>
      <p className="optional">Inspect, edit or delete this agent’s local notes.</p>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <BookOpen size={14} />
        Open memory
      </Button>
      {open && data ? (
        <AgentMemoryPanel data={data} roleId={roleId} close={() => setOpen(false)} />
      ) : null}
    </section>
  );
}
function AgentMemoryPanel({
  data,
  roleId,
  close,
}: {
  data: Snapshot;
  roleId: string;
  close: () => void;
}) {
  const action = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  const [selectedRole, setSelectedRole] = useState(roleId);
  const { openChat } = useWorkspaceNavigation();
  return (
    <MemoryNotebook
      data={data}
      roleId={selectedRole}
      recipientItems={data.roles.map((role) => ({ value: role.id, label: role.name }))}
      setRecipient={setSelectedRole}
      onThread={openChat}
      action={action}
      working={working}
      setDialog={close}
    />
  );
}
