import { Pause, Play, Square } from 'lucide-react';
import type { WorkQueueView } from '@pitchcrew/core';
import type { useQueueActions } from '@/hooks/useQueueActions.ts';
import { menuComponents } from '@/components/ui/context-menu/menu-components.ts';

export const QueueRunningItems = ({
  queue,
  model,
  context = false,
}: {
  queue: WorkQueueView;
  model: ReturnType<typeof useQueueActions>;
  context?: boolean;
}) => {
  const { command, working, resumeBlocked } = model;
  const PauseIcon = queue.paused ? Play : Pause;
  const Menu = menuComponents(context);
  return (
    <Menu.Group>
      <Menu.Item
        disabled={working || resumeBlocked}
        onClick={() => command(queue.paused ? 'resume' : 'pause')}
      >
        <PauseIcon size={14} />
        {queue.paused ? 'Resume queue' : 'Pause queue'}
      </Menu.Item>
      <Menu.Item disabled={working} onClick={() => command('stop')}>
        <Square size={14} />
        Stop current work
      </Menu.Item>
    </Menu.Group>
  );
};
