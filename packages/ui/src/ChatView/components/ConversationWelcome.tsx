import { conversationStarters, rolePurpose } from '@/ChatView/constants.ts';
import type { ConversationWelcomeProps } from '@/ChatView/types.ts';
import { ConversationEmptyState } from '@/components/ai-elements/conversation/components/ConversationEmptyState.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ArrowRight, Users } from 'lucide-react';

export function ConversationWelcome({
  thread,
  roleId,
  role,
  applyStarter,
  attached,
}: ConversationWelcomeProps) {
  return (
    <ConversationEmptyState className="chat-empty">
      <div className="chat-empty-identity">
        {thread === 'crew' ? (
          <span className="crew-chat-icon">
            <Users size={30} />
          </span>
        ) : (
          <RoleAvatar agentRole={roleId} size="large" />
        )}
      </div>
      <h3>{thread === 'crew' ? 'Bring the crew together' : rolePurpose[roleId]}</h3>
      <p>
        {thread === 'crew'
          ? 'Follow the handoffs, ask a question, or help the crew decide what comes next.'
          : `${role.description} Start with a question, or attach a job to work on an application.`}
      </p>
      <div className="chat-starters">
        {thread === 'crew' ? (
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
            {conversationStarters[roleId]
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
    </ConversationEmptyState>
  );
}
