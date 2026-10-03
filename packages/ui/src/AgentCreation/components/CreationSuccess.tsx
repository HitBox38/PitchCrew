import { Button } from '@/components/ui/button/components/Button.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import type { Role } from '@pitchcrew/core';

export function CreationSuccess({
  role,
  scheduled,
  close,
}: {
  role: Role;
  scheduled: boolean;
  close(): void;
}) {
  const setRoleId = useWorkspaceStore((state) => state.setRoleId);
  const { openChat } = useWorkspaceNavigation();
  return (
    <div className="role-settings-body flex flex-col gap-5">
      <h3 className="text-xl">{role.name} has joined your crew</h3>
      <p>{role.description}</p>
      <p className="quiet">
        {role.enabled
          ? 'Start with a message to give this agent its first task.'
          : 'This agent starts paused. Enable it in settings when you are ready.'}
        {scheduled ? ' Its first routine is saved on the Routines page.' : ''}
      </p>
      <div className="flex flex-wrap gap-3">
        {role.enabled ? (
          <Button
            className="button primary"
            onClick={() => {
              close();
              openChat(role.id);
            }}
          >
            Open chat
          </Button>
        ) : null}
        <Button
          onClick={() => {
            close();
            setRoleId(role.id);
          }}
        >
          Open settings
        </Button>
        <Button variant="ghost" onClick={close}>
          Done
        </Button>
      </div>
    </div>
  );
}
