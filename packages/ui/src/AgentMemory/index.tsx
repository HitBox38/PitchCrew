import { useState } from 'react';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import { MemoryNotebook } from '@/ChatView/components/MemoryNotebook.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { BookOpen } from 'lucide-react';
import type { Snapshot } from '@pitchcrew/core';

/** The agent's own saved notes: inspect, edit or delete them. Never profile evidence. */
export const AgentMemory = ({ roleId }: { roleId: string }) => {
  const [open, setOpen] = useState(false);
  const data = useWorkspaceStore((state) => state.data);
  const count = data?.memories?.filter(
    (memory) => memory.roleId === roleId && !memory.deleted,
  ).length;
  return (
    <section
      className="agent-panel-section"
      id="agent-memory"
      aria-labelledby="agent-memory-heading"
    >
      <h3 id="agent-memory-heading">
        Memory {count !== undefined ? <span className="ui-count">{count}</span> : null}
      </h3>
      <p className="optional">Local notes this agent saved. Not used as profile evidence.</p>
      <Button className="button small self-start" onClick={() => setOpen(true)}>
        <BookOpen size={14} aria-hidden="true" />
        Open memory
      </Button>
      {open && data ? (
        <AgentMemoryPanel key={roleId} data={data} roleId={roleId} close={() => setOpen(false)} />
      ) : null}
    </section>
  );
};
const AgentMemoryPanel = ({
  data,
  roleId,
  close,
}: {
  data: Snapshot;
  roleId: string;
  close: () => void;
}) => {
  const action = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  // react-doctor-disable-next-line react-doctor/no-derived-useState -- The notebook starts at this agent and then owns its selection.
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
};
