import type { Role } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { AccordionSection } from '@pitchcrew/design-system/accordion';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { RotateCcw } from 'lucide-react';

const day = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/** Retired agents keep their history; Restore brings one back paused under the same identity. */
export const CrewRetired = ({ roles }: { roles: Role[] }) => {
  const act = useWorkspaceStore((state) => state.act);
  const working = useWorkspaceStore((state) => state.working);
  if (!roles.length) return null;
  return (
    <section className="ui-section crew-retired" aria-label="Retired agents">
      <AccordionSection
        triggerClassName="crew-disclosure-trigger"
        heading={
          <>
            Retired <span className="ui-count">{roles.length}</span>
          </>
        }
      >
        <ul className="ui-tray crew-retired-list">
          {roles.map((role) => (
            <li key={role.id} className="ui-row">
              <RoleAvatar agentRole={role.id} />
              <span className="crew-row-copy">
                <strong>{role.name}</strong>
                <span className="ui-row-meta">
                  Retired {day(role.retiredAt!)}. Restores paused, with its history and skills.
                </span>
              </span>
              <Button
                className="button small"
                disabled={working}
                onClick={() =>
                  act(`/roles/${role.id}/restore`, 'POST', {}, `${role.name} restored paused`)
                }
              >
                <RotateCcw size={14} aria-hidden="true" /> Restore
                <span className="sr-only"> {role.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      </AccordionSection>
    </section>
  );
};
