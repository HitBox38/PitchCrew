import { rolePurpose } from '@/ChatView/constants.ts';
import type { ConversationRailProps } from '@/ChatView/types.ts';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { HardDrive, Users } from 'lucide-react';

export function ConversationRail({ data, thread, onThread, setError }: ConversationRailProps) {
  return (
    <nav className="chat-rail" aria-label="Conversations">
      <div className="chat-rail-heading">
        <h2>Conversations</h2>
        <span>{data.roles.length} roles</span>
      </div>
      {data.roles.map((item) => {
        const latest = data.messages.findLast((m) => m.threadId === item.id);
        const reviewCount =
          data.proposals.filter(
            (proposal) => proposal.roleId === item.id && proposal.status === 'pending',
          ).length +
          data.skillProposals.filter(
            (proposal) => proposal.roleId === item.id && proposal.status === 'pending',
          ).length;
        const active = data.runs.some((r) => r.roleId === item.id && r.status === 'running');
        return (
          <Button
            key={item.id}
            variant="ghost"
            className={`chat-thread ${thread === item.id ? 'selected' : ''}`}
            aria-current={thread === item.id ? 'page' : undefined}
            onClick={() => {
              onThread(item.id);
              setError('');
            }}
          >
            <RoleAvatar agentRole={item.id} size="normal" />
            <span className="chat-thread-copy">
              <strong>
                {item.name}
                {reviewCount ? (
                  <span className="chat-count" title={`${reviewCount} proposed changes`}>
                    {reviewCount}
                  </span>
                ) : null}
                <span
                  className={`chat-role-dot ${active ? 'working' : !item.enabled ? 'paused' : ''}`}
                  title={active ? 'Working' : item.enabled ? 'Enabled' : 'Paused'}
                />
              </strong>
              <small>
                {active
                  ? 'Working…'
                  : latest
                    ? `${latest.from === 'user' ? 'You: ' : ''}${latest.content}`
                    : (rolePurpose[item.id] ?? item.description)}
              </small>
            </span>
          </Button>
        );
      })}
      <div className="chat-rail-divider" />
      <Button
        variant="ghost"
        className={`chat-thread ${thread === 'crew' ? 'selected' : ''}`}
        aria-current={thread === 'crew' ? 'page' : undefined}
        onClick={() => {
          onThread('crew');
          setError('');
        }}
      >
        <span className="crew-chat-icon">
          <Users size={19} />
        </span>
        <span className="chat-thread-copy">
          <strong>Crew conversation</strong>
          <small>Shared messages and handoffs</small>
        </span>
      </Button>
      <div className="chat-rail-note">
        <HardDrive size={14} />
        <span>Saved on this device</span>
      </div>
    </nav>
  );
}
