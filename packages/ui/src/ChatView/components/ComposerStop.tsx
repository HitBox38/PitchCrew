import type { ChatComposerProps } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip/index.tsx';
import { Square } from 'lucide-react';

export function ComposerStop({
  action,
  thread,
  participants,
  working,
  inputRef,
}: Pick<ChatComposerProps, 'action' | 'thread' | 'participants' | 'working' | 'inputRef'>) {
  const label = participants.length > 1 ? 'Stop conversation' : 'Stop response';
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-sm"
            variant="secondary"
            className="chat-stop-response"
            aria-label={label}
            disabled={working}
            onClick={() =>
              void action(`/conversations/${thread}/stop`, 'POST')
                .then(() => requestAnimationFrame(() => inputRef.current?.focus()))
                .catch(() => {})
            }
          />
        }
      >
        <Square size={13} fill="currentColor" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
