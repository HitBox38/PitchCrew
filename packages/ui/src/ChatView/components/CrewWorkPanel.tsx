import type { CrewWorkPanelProps } from '@/ChatView/types.ts';
import { ChatWork } from '@/ChatWork/index.tsx';
import { TabsContent } from '@/components/ui/tabs/components/TabsContent.tsx';

export function CrewWorkPanel({
  data,
  thread,
  role,
  proposals,
  skillProposals,
  tasks,
  action,
  working,
  onConfigure,
  roleId,
  onOpenCard,
}: CrewWorkPanelProps) {
  return (
    <TabsContent value="work" className="chat-work-panel">
      <ChatWork
        data={data}
        thread={thread}
        role={role}
        proposals={proposals}
        skillProposals={skillProposals}
        tasks={tasks}
        action={action}
        working={working}
        onConfigure={() => onConfigure(roleId)}
        onOpenCard={onOpenCard}
      />
    </TabsContent>
  );
}
