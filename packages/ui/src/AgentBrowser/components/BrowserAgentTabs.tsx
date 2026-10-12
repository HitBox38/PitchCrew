import { Button } from '@/components/ui/button/components/Button.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import type { AgentBrowserProps } from '../types.ts';
export function BrowserAgentTabs({
  browserPanel,
  data,
}: Pick<AgentBrowserProps, 'browserPanel' | 'data'>) {
  return (
    <fieldset className="browser-agent-tabs" aria-label="Agent browsers">
      {browserPanel.roles.map((role) => {
        const session = browserPanel.sessions.find((item) => item.roleId === role.id);
        const waiting = data.computerApprovals.some(
          (approval) => approval.roleId === role.id && approval.status === 'pending',
        );
        return (
          <Button
            key={role.id}
            size="sm"
            variant={role.id === browserPanel.role?.id ? 'secondary' : 'ghost'}
            aria-pressed={role.id === browserPanel.role?.id}
            onClick={() => browserPanel.select(role.id)}
          >
            <RoleAvatar agentRole={role.id} size="small" />
            <span>{role.name}</span>
            {waiting ? (
              <span className="badge">Waiting for you</span>
            ) : session?.manual ? (
              <span className="badge">Manual</span>
            ) : session?.runId ? (
              <span className="chat-role-dot working" aria-label="Browsing" />
            ) : null}
          </Button>
        );
      })}
    </fieldset>
  );
}
