import type { ConversationHeadingProps } from '@/ChatView/types.ts';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { runtimeLabels } from '@/lib/labels.ts';
import { SlidersHorizontal, Users } from 'lucide-react';

export function ConversationHeading({
  thread,
  roleId,
  role,
  roleState,
  running,
  data,
  onConfigure,
}: ConversationHeadingProps) {
  return (
    <header className="chat-heading">
      {thread === 'crew' ? (
        <span className="crew-chat-icon">
          <Users size={22} />
        </span>
      ) : (
        <RoleAvatar agentRole={roleId} size="large" />
      )}
      <div>
        <h2>{thread === 'crew' ? 'Crew conversation' : role.name}</h2>
        <p>
          {thread === 'crew'
            ? 'Follow the crew’s work and join the conversation.'
            : role.description}
        </p>
      </div>
      <div className="chat-heading-actions">
        <span className={`chat-role-state ${roleState.toLowerCase()}`}>
          <span className="chat-role-dot" />
          {thread === 'crew'
            ? running.length
              ? `${running.length} working`
              : `${data.roles.length} roles`
            : roleState}
        </span>
        <Button
          variant="ghost"
          className="chat-runtime"
          disabled={!!role.retiredAt}
          onClick={() => onConfigure(roleId)}
          title={
            role.runtime === 'demo'
              ? 'Demo replies are scripted. Choose Claude Code or Codex for AI conversations.'
              : `Change ${role.name}’s runtime`
          }
        >
          {runtimeLabels[role.runtime]}
          {role.runtime === 'demo' ? <span>Scripted</span> : null}
        </Button>
        <Button
          variant="ghost"
          className="chat-settings"
          aria-label={`Configure ${role.name}`}
          disabled={!!role.retiredAt}
          onClick={() => onConfigure(roleId)}
        >
          <SlidersHorizontal size={16} />
          <span>Settings</span>
        </Button>
      </div>
    </header>
  );
}
