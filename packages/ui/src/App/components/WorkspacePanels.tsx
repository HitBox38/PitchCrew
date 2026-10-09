import {
  AddOpportunity,
  CardDetails,
  RoleSettings,
  ConversationCreation,
} from '@/App/constants.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { WorkspacePanelsProps } from '@/App/types.ts';
import { AnimatePresence } from 'motion/react';
import { Suspense } from 'react';

export function WorkspacePanels({
  add,
  action,
  working,
  setAdd,
  selected,
  data,
  setSelectedId,
  go,
  selectedRole,
  navigate,
  setRoleId,
}: WorkspacePanelsProps) {
  const creatingConversation = useWorkspaceStore((state) => state.creatingConversation);
  const setCreatingConversation = useWorkspaceStore((state) => state.setCreatingConversation);
  return (
    <Suspense fallback={null}>
      <AnimatePresence>
        {creatingConversation ? (
          <ConversationCreation
            key="new-conversation"
            data={data}
            action={action}
            working={working}
            onClose={() => setCreatingConversation(false)}
          />
        ) : null}
        {add ? (
          <AddOpportunity
            key="add-job"
            action={action}
            working={working}
            onClose={() => setAdd(false)}
          />
        ) : null}
        {selected ? (
          <CardDetails
            key={selected.id}
            card={selected}
            data={data}
            action={action}
            working={working}
            onClose={() => setSelectedId(null)}
            onInbox={() => go('inbox')}
          />
        ) : null}
        {selectedRole ? (
          <RoleSettings
            key={selectedRole.id}
            onManageSkills={() => {
              void navigate({ to: '/skills', search: { filter: selectedRole.id } });
              setRoleId(null);
            }}
            role={selectedRole}
            data={data}
            action={action}
            working={working}
            onClose={() => setRoleId(null)}
          />
        ) : null}
      </AnimatePresence>
    </Suspense>
  );
}
