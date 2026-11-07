import type { RuntimeInfo } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Button } from '@pitchcrew/design-system/button';
import { reasoningLabels } from '@/lib/reasoning.ts';

export const RuntimeAssignments = ({
  runtime,
  leave,
}: {
  runtime: RuntimeInfo;
  leave: (action: () => void) => void;
}) => {
  const roles =
    useWorkspaceStore((store) => store.data?.roles)?.filter(
      (role) => !role.retiredAt && role.runtime === runtime.id,
    ) ?? [];
  return (
    <section className="runtime-assignments" aria-label="Agents using this runtime">
      <h3>Agent defaults</h3>
      <p className="quiet">
        Saved agent defaults apply to workflows and routines. Conversation overrides stay in their
        chat.
      </p>
      {roles.length ? (
        <ul className="settings-list">
          {roles.map((role) => (
            <li key={role.id} className="settings-list-row">
              <div className="settings-list-main">
                <div className="min-w-0 flex-1">
                  <strong>{role.name}</strong>
                  <p className="quiet break-words">
                    {role.model || 'CLI default'}
                    {role.reasoning ? ` · ${reasoningLabels[role.reasoning]}` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => leave(() => useWorkspaceStore.getState().setRoleId(role.id))}
                  aria-label={`Configure ${role.name}`}
                >
                  Configure
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="quiet">
          No agents use this runtime yet. Select it when configuring an agent in Crew.
        </p>
      )}
    </section>
  );
};
