import type { ChatComposerProps } from '../types.ts';
import { Button } from '@pitchcrew/design-system/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@pitchcrew/design-system/tooltip';
import { Square } from 'lucide-react';

export const ComposerStop = ({
  action,
  thread,
  participants,
  working,
  inputRef,
}: Pick<ChatComposerProps, 'action' | 'thread' | 'participants' | 'working' | 'inputRef'>) => {
  const label = participants.length > 1 ? 'Stop conversation' : 'Stop response';
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="sm"
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
        <Square size={12} fill="currentColor" aria-hidden="true" />
        <span aria-hidden="true">Stop</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};
