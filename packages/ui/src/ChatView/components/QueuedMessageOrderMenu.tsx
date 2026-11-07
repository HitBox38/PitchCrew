import { DropdownMenuGroup, DropdownMenuItem } from '@pitchcrew/design-system/dropdown-menu';

export const QueuedMessageOrderMenu = ({
  canMoveEarlier,
  canMoveLater,
  queuePaused,
  update,
}: {
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  queuePaused: boolean;
  update: (command: string) => Promise<unknown>;
}) => (
  <DropdownMenuGroup>
    <DropdownMenuItem
      disabled={!canMoveEarlier || queuePaused}
      title={
        queuePaused
          ? 'The queue is paused. Use its recovery action, or choose Send now and resume queue.'
          : !canMoveEarlier
            ? 'This message cannot move ahead of the first or an active reply.'
            : undefined
      }
      onClick={() => void update('next')}
    >
      Make next
    </DropdownMenuItem>
    <DropdownMenuItem
      disabled={!canMoveEarlier}
      title={
        !canMoveEarlier
          ? 'This message cannot move ahead of the first or an active reply.'
          : undefined
      }
      onClick={() => void update('up')}
    >
      Move earlier
    </DropdownMenuItem>
    <DropdownMenuItem
      disabled={!canMoveLater}
      title={
        !canMoveLater ? 'This is the last waiting message, or its reply is active.' : undefined
      }
      onClick={() => void update('down')}
    >
      Move later
    </DropdownMenuItem>
  </DropdownMenuGroup>
);
