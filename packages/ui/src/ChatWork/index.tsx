import { CrewTasks } from '@/ChatWork/components/CrewTasks.tsx';
import { RoleCapabilities } from '@/ChatWork/components/RoleCapabilities.tsx';
import { RoleProposals } from '@/ChatWork/components/RoleProposals.tsx';
import { SkillProposals } from '@/ChatWork/components/SkillProposals.tsx';
import { getChatWorkModel } from '@/ChatWork/helpers.ts';
import type { ChatWorkProps } from '@/ChatWork/types.ts';

export function ChatWork(props: ChatWorkProps) {
  const controller = getChatWorkModel(props);
  const { thread } = controller;
  return (
    <div className="chat-work-content">
      <RoleProposals {...controller} />
      <SkillProposals {...controller} />
      <CrewTasks {...controller} />
      {thread !== 'crew' ? <RoleCapabilities {...controller} /> : null}
    </div>
  );
}
