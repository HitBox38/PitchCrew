import { Button } from '@pitchcrew/design-system/button';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import type { Role } from '@pitchcrew/core';

export const CreationSuccess = ({
  role,
  scheduled,
  close,
}: {
  role: Role;
  scheduled: boolean;
  close(): void;
}) => {
  const setRoleId = useWorkspaceStore((state) => state.setRoleId);
  const { openChat } = useWorkspaceNavigation();
  return (
    <div className="agent-wizard-body agent-wizard-step">
      <p>{role.description}</p>
      <p className="optional">
        {role.enabled
          ? 'Start with a message to give this agent its first task.'
          : 'This agent starts paused. Enable it in settings when you are ready.'}
        {scheduled ? ' Its first routine is saved on the Routines page.' : ''}
      </p>
      <div className="agent-wizard-success-actions">
        {role.enabled ? (
          <Button
            className="button small primary"
            onClick={() => {
              close();
              openChat(role.id);
            }}
          >
            Open chat
          </Button>
        ) : null}
        <Button
          className="button small"
          onClick={() => {
            close();
            setRoleId(role.id);
          }}
        >
          Open settings
        </Button>
        <Button className="button small" onClick={close}>
          Done
        </Button>
      </div>
    </div>
  );
};
