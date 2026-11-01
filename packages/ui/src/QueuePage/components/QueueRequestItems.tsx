import { ArrowDown, ArrowUp, ArrowUpToLine, Pencil, Trash2 } from 'lucide-react';
import { menuComponents } from '@/components/ui/context-menu/menu-components.ts';
import type { useQueueRequest } from '../hooks/useQueueRequest.ts';

/** Ordering, editing and removal for one queued request; failed requests offer ordering only. */
export const QueueRequestItems = ({
  model,
  context = false,
}: {
  model: ReturnType<typeof useQueueRequest>;
  context?: boolean;
}) => {
  const { editable, failed, working, command, setEditing, moves } = model;
  const Menu = menuComponents(context);
  const order = [
    ['Make next', ArrowUpToLine, moves.makeNext],
    ['Move up', ArrowUp, moves.up],
    ['Move down', ArrowDown, moves.down],
  ] as const;
  return (
    <Menu.Group>
      {order.map(([label, Icon, run]) =>
        run ? (
          <Menu.Item key={label} disabled={working} onClick={run}>
            <Icon size={14} />
            {label}
          </Menu.Item>
        ) : null,
      )}
      {editable && !failed ? (
        <Menu.Item disabled={working} onClick={() => setEditing(true)}>
          <Pencil size={14} />
          Edit message
        </Menu.Item>
      ) : null}
      {failed ? null : (
        <Menu.Item disabled={working} variant="destructive" onClick={() => command('remove')}>
          <Trash2 size={14} />
          Remove request
        </Menu.Item>
      )}
    </Menu.Group>
  );
};
