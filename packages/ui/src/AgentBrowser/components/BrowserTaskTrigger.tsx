import { CircleDot, EyeOff, Info, ShieldCheck } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { PopoverTrigger } from '@pitchcrew/design-system/popover';
import { cn } from '@pitchcrew/design-system/utils';
import type { BrowserModeChip } from '../layout.ts';

const icons = { supervised: CircleDot, autonomous: ShieldCheck, private: EyeOff };

/** Opens task details; it is the mode chip (Supervised, Autonomous preparation or Private)
 * whenever a task or takeover is active. */
export const BrowserTaskTrigger = ({
  chip,
  elsewhere,
}: {
  chip: BrowserModeChip | null;
  elsewhere: boolean;
}) => {
  const Icon = chip ? icons[chip.tone] : Info;
  const where = elsewhere ? ' This browser belongs to another conversation.' : '';
  return (
    <PopoverTrigger
      render={
        <Button
          size={chip ? 'sm' : 'icon-sm'}
          variant="ghost"
          className={cn(
            'browser-task-trigger',
            chip && 'browser-mode-chip',
            elsewhere && 'browser-task-elsewhere',
          )}
          data-tone={chip?.tone}
          aria-label={chip ? `Browser task details: ${chip.label}` : 'Browser task details'}
          title={
            chip
              ? `${chip.detail}${where}`
              : elsewhere
                ? 'This browser belongs to another conversation'
                : 'Current task, permissions and site access'
          }
        />
      }
    >
      <Icon size={chip ? 14 : 15} aria-hidden={chip ? true : undefined} />
      {chip ? <span className="truncate">{chip.label}</span> : null}
    </PopoverTrigger>
  );
};
