import { Pencil, Trash2 } from 'lucide-react';
import { menuComponents } from '@/components/ui/context-menu/menu-components.ts';
import type { useQueueRequest } from '../hooks/useQueueRequest.ts';

export const QueueRequestItems = ({
  model,
  context = false,
}: {
  model: ReturnType<typeof useQueueRequest>;
  context?: boolean;
}) => {
  const { editable, working, command, setEditing } = model;
  const Menu = menuComponents(context);
  return (
    <Menu.Group>
      {editable ? (
        <Menu.Item disabled={working} onClick={() => setEditing(true)}>
          <Pencil size={14} />
          Edit message
        </Menu.Item>
      ) : null}
      <Menu.Item disabled={working} variant="destructive" onClick={() => command('remove')}>
        <Trash2 size={14} />
        Remove request
      </Menu.Item>
    </Menu.Group>
  );
};
