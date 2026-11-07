import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@pitchcrew/design-system/dropdown-menu';
import { Ellipsis } from 'lucide-react';
import type { ChatRequest } from '@pitchcrew/core';
import { useRef } from 'react';
import { runQueueRecovery } from '../queue-focus.ts';
import { QueuedMessageOrderMenu } from './QueuedMessageOrderMenu.tsx';
export const QueuedMessageMenu = ({
  update,
  working,
  request,
  busy,
  canMoveEarlier,
  canMoveLater,
  queuePaused,
  menuRecovery,
}: {
  update: (command: string) => Promise<unknown>;
  working: boolean;
  request: ChatRequest;
  busy: boolean;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  queuePaused: boolean;
  menuRecovery: { label: string; description: string } | null;
}) => {
  const trigger = useRef<HTMLButtonElement>(null);
  const recover = (command: string) => {
    if (trigger.current) void runQueueRecovery(trigger.current, () => update(command));
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        ref={trigger}
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            className="chat-queued-menu"
            aria-label="Queued message options"
            title="Queued message options"
            disabled={working}
          />
        }
      >
        <Ellipsis size={13} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {menuRecovery ? (
            <DropdownMenuItem title={menuRecovery.description} onClick={() => recover('resume')}>
              {menuRecovery.label}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => recover('interrupt')}>
            {busy
              ? 'Interrupt current work and send'
              : queuePaused
                ? 'Send now and resume queue'
                : 'Send now'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <QueuedMessageOrderMenu {...{ canMoveEarlier, canMoveLater, queuePaused, update }} />
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => void update('remove')}>
            {request.deliveries.some((delivery) => !!delivery.runId)
              ? 'Cancel remaining replies'
              : 'Remove message'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
