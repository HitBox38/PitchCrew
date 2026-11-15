import type { CrewRolesProps } from '@/AppSidebar/types.ts';
import { SidebarGroupContent, SidebarMenu, useSidebar } from '@pitchcrew/design-system/sidebar';
import { getRoleStatus } from '@/lib/role-status.ts';
import { CrewRoleRow } from './CrewRoleRow.tsx';
import { SidebarCategory } from './SidebarCategory.tsx';
import { useStableCallbacks } from '@/lib/use-stable-callbacks.ts';
import type { Role } from '@pitchcrew/core';

/** Every current agent in roster order: pebble, name, readable state and a quick menu. */
export const CrewRoles = ({ data, working, onConfigureRole, onToggleRole }: CrewRolesProps) => {
  const { state, isMobile } = useSidebar();
  const callbacks = useStableCallbacks({
    configure: onConfigureRole,
    toggle: (role: Role) => void onToggleRole(role),
  });
  const roles = data.roles.filter((role) => !role.retiredAt);
  if (!roles.length || (state === 'collapsed' && !isMobile)) return null;
  const running = new Set(
    data.runs.filter((run) => run.status === 'running').map((run) => run.roleId),
  );
  const asking = new Set(
    data.userInputs?.filter((q) => q.status === 'pending').map((q) => q.roleId) ?? [],
  );
  return (
    <SidebarCategory id="crew" label="Crew" className="sidebar-crew" defaultOpen={false}>
      <SidebarGroupContent>
        <SidebarMenu>
          {roles.map((role) => (
            <CrewRoleRow
              key={role.id}
              role={role}
              status={getRoleStatus(role, data)}
              running={running.has(role.id)}
              asking={asking.has(role.id)}
              working={working}
              onConfigure={callbacks.configure}
              onToggle={callbacks.toggle}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarCategory>
  );
};
