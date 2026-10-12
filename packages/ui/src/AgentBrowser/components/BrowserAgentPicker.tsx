import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu/index.tsx';
import type { AgentBrowserProps } from '../types.ts';
export function BrowserAgentPicker({
  browserPanel,
  data,
}: Pick<AgentBrowserProps, 'browserPanel' | 'data'>) {
  const role = browserPanel.role!;
  const identity = (
    <>
      <RoleAvatar agentRole={role.id} size="small" />
      <span className="truncate">{role.name}</span>
    </>
  );
  if (browserPanel.roles.length < 2)
    return (
      <h2 className="browser-agent-name">
        {identity}
        <span className="sr-only">browser</span>
      </h2>
    );
  return (
    <DropdownMenu modal={false}>
      <h2 className="sr-only">{role.name} browser</h2>
      <DropdownMenuTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className="browser-agent-picker"
            aria-label={`Select agent browser, current: ${role.name}`}
          />
        }
      >
        {identity}
        <ChevronDown size={12} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Agent browsers</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuRadioGroup
          value={role.id}
          onValueChange={(value) => browserPanel.select(value)}
        >
          {browserPanel.roles.map((agent) => {
            const session = browserPanel.sessions.find((item) => item.roleId === agent.id);
            const waiting = data.computerApprovals.some(
              (approval) => approval.roleId === agent.id && approval.status === 'pending',
            );
            return (
              <DropdownMenuRadioItem key={agent.id} value={agent.id} closeOnClick>
                <RoleAvatar agentRole={agent.id} size="small" />
                <span>{agent.name}</span>
                {waiting ? (
                  <span className="badge">Waiting for you</span>
                ) : session?.manual ? (
                  <span className="badge">Manual</span>
                ) : session?.runId ? (
                  <span className="quiet">Browsing</span>
                ) : null}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
