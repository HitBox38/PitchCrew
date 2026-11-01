import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import type { RoleSettingsModel } from '@/components/RoleSettings/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { SheetDescription } from '@/components/ui/sheet/components/SheetDescription.tsx';
import { SheetTitle } from '@/components/ui/sheet/components/SheetTitle.tsx';
import { Switch } from '@/components/ui/switch/index.tsx';
import { crewStatus, runtimeLine } from '@/CrewPage/helpers.ts';
import { useNow } from '@/ClayInterface/hooks/useNow.ts';
import { X } from 'lucide-react';

const stateWords = {
  working: 'Working',
  waiting: 'Waiting on your answer',
  paused: 'Paused',
  unavailable: 'Runtime unavailable',
  signin: 'Needs sign-in',
  idle: 'Idle',
};

/** Pebble, name and current state, with enable/pause, Chat and Close always in reach. */
export const RoleSettingsHeading = ({
  role,
  data,
  creating,
  working,
  onClose,
  chat,
  toggleEnabled,
}: RoleSettingsModel) => {
  const now = useNow();
  const status = creating ? undefined : crewStatus(role, data, now);
  const running = data.runs.some((run) => run.roleId === role.id && run.status === 'running');
  const blocked = running ? `Wait until ${role.name}’s run finishes.` : undefined;
  return (
    <header className="agent-panel-heading">
      <span className="crew-pebble agent-panel-pebble">
        <RoleAvatar agentRole={role.id} size="large" />
      </span>
      <div className="agent-panel-titles">
        <SheetTitle>{role.name || 'New agent'}</SheetTitle>
        <SheetDescription>
          {status
            ? `${status.kind === 'working' ? `Working on ${status.subject}` : stateWords[status.kind]} · ${runtimeLine(role, data)}`
            : role.description}
        </SheetDescription>
      </div>
      {creating ? null : (
        <div className="agent-panel-heading-actions">
          <span className="agent-panel-enabled" title={blocked}>
            <Switch
              aria-label="Enable this role"
              checked={role.enabled}
              disabled={working || Boolean(blocked)}
              onCheckedChange={() => void toggleEnabled()}
            />
            <span aria-hidden="true">{role.enabled ? 'Enabled' : 'Paused'}</span>
          </span>
          <Button className="text-button agent-panel-chat" onClick={chat}>
            Chat<span className="sr-only"> with {role.name}</span>
          </Button>
        </div>
      )}
      <Button
        variant="ghost"
        className="icon-button agent-panel-close"
        onClick={onClose}
        aria-label="Close agent settings"
      >
        <X size={18} />
      </Button>
    </header>
  );
};
