import { conversationStarters, rolePurpose } from '@/ChatView/constants.ts';
import type { ConversationWelcomeProps } from '@/ChatView/types.ts';
import { ConversationEmptyState } from '@/components/ai-elements/conversation/components/ConversationEmptyState.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ArrowRight, Users } from 'lucide-react';

export function ConversationWelcome({
  roleId,
  role,
  applyStarter,
  attached,
  conversation,
  readOnly,
}: ConversationWelcomeProps) {
  const group = (conversation?.participants.length ?? 1) > 1;
  return (
    <ConversationEmptyState className="chat-empty">
      <div className="chat-empty-identity">
        {group || readOnly ? (
          <span className="crew-chat-icon">
            <Users size={30} />
          </span>
        ) : (
          <RoleAvatar agentRole={roleId} size="large" />
        )}
      </div>
      <h3>{group || readOnly ? conversation?.title : (rolePurpose[roleId] ?? role.name)}</h3>
      <p>
        {readOnly
          ? 'Saved exchanges appear here. You can follow the work and open a separate conversation to join in.'
          : group
            ? 'Ask the group, or mention an agent by @id to direct your request. The lead coordinates the work.'
            : `${role.description} Start with a question, or attach a job to work on an application.`}
      </p>
      {!readOnly ? (
        <div className="chat-starters mt-6.25 grid w-full max-w-110 grid-cols-2 gap-2.5 max-chat:mt-5 max-chat:gap-2">
          {group ? (
            <Button
              className="chat-starter"
              variant="outline"
              onClick={() =>
                applyStarter(
                  'Explain how the crew can help me take an application from evaluation through review.',
                )
              }
            >
              <span>How does the crew work?</span>
              <ArrowRight size={15} />
            </Button>
          ) : (
            <>
              <Button
                className="chat-starter"
                variant="outline"
                onClick={() =>
                  applyStarter(
                    'What can you help me with, and how do you work with the other agents?',
                  )
                }
              >
                <span>Ask about this role</span>
                <ArrowRight size={15} />
              </Button>
              {(conversationStarters[roleId] ?? [])
                .filter((starter) => attached || !starter.prompt.includes('attached job'))
                .map((starter) => (
                  <Button
                    className="chat-starter"
                    variant="outline"
                    key={starter.label}
                    onClick={() => applyStarter(starter.prompt)}
                  >
                    <span>{starter.label}</span>
                    <ArrowRight size={15} />
                  </Button>
                ))}
            </>
          )}
        </div>
      ) : null}
    </ConversationEmptyState>
  );
}
