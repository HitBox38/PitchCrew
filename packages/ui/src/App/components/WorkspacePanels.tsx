import {
  AddOpportunity,
  CardDetails,
  RoleSettings,
  ConversationCreation,
} from '@/App/constants.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { JobLoading } from '@/components/CardDetails/components/JobLoading.tsx';
import type { WorkspacePanelsProps } from '@/App/types.ts';
import { AnimatePresence } from 'motion/react';
import { Suspense } from 'react';

export const WorkspacePanels = ({
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
}: WorkspacePanelsProps) => {
  const selectedJobSection = useWorkspaceStore((state) => state.selectedJobSection);
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
            data={data}
            action={action}
            working={working}
            onClose={() => setAdd(false)}
          />
        ) : null}
        {selected ? (
          <Suspense
            key={selected.id}
            fallback={<JobLoading card={selected} onClose={() => setSelectedId(null)} />}
          >
            <CardDetails
              card={selected}
              data={data}
              action={action}
              working={working}
              onClose={() => setSelectedId(null)}
              initialSection={selectedJobSection}
              onInbox={() => go('inbox')}
              onChat={(thread, run) => {
                setSelectedId(null);
                void navigate({ to: '/chat/$thread', params: { thread }, search: { run } });
              }}
            />
          </Suspense>
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
};
