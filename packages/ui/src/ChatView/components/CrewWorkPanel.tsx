import type { CrewWorkPanelProps } from '@/ChatView/types.ts';
import { ChatWork } from '@/ChatWork/index.tsx';
import { TabsContent } from '@pitchcrew/design-system/tabs';

export const CrewWorkPanel = ({
  data,
  thread,
  role,
  proposals,
  skillProposals,
  tasks,
  rounds,
  action,
  working,
  onConfigure,
  roleId,
  onOpenCard,
}: CrewWorkPanelProps) => {
  return (
    <TabsContent value="work" className="chat-work-panel">
      <ChatWork
        data={data}
        thread={thread}
        role={role}
        proposals={proposals}
        skillProposals={skillProposals}
        tasks={tasks}
        rounds={rounds}
        action={action}
        working={working}
        onConfigure={() => onConfigure(roleId)}
        onOpenCard={onOpenCard}
      />
    </TabsContent>
  );
};
