import type { ChatComposerProps } from '../types.ts';
import { Button } from '@pitchcrew/design-system/button';
import { runtimeLabels } from '@/lib/labels.ts';
import { reasoningLabels } from '@/lib/reasoning.ts';
import { ChevronDown, Cpu } from 'lucide-react';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';

/** The clay composer names the model the next turn uses and opens Conversation runtime. */
export const ComposerRuntime = ({ role, setDialog, working, participants }: ChatComposerProps) => {
  const label = [
    role.model || runtimeLabels[role.runtime],
    role.reasoning && reasoningLabels[role.reasoning],
  ]
    .filter(Boolean)
    .join(' · ');
  const group = participants.length > 1;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="chat-composer-runtime"
      aria-label={`Conversation runtime${group ? ` for ${role.name}` : ''}: ${label}`}
      title={group ? `${role.name} runtime` : undefined}
      disabled={working}
      onClick={() => setDialog('runtime')}
    >
      {group ? (
        <RoleAvatar agentRole={role.id} size="small" />
      ) : (
        <Cpu size={13} aria-hidden="true" />
      )}
      <span>{label}</span>
      <ChevronDown size={12} aria-hidden="true" />
    </Button>
  );
};
