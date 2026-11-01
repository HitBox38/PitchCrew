import type { InstructionUpdate, Snapshot } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { AccordionSection } from '@pitchcrew/design-system/accordion';

/** Default versions the user chose to keep their own text over, still open for comparison. */
export const CrewDismissed = ({
  data,
  onReview,
}: {
  data: Snapshot;
  onReview: (id: string) => void;
}) => {
  const dismissed = (data.instructionUpdates ?? []).filter(
    (update: InstructionUpdate) =>
      update.dismissed && data.roles.some((role) => role.id === update.roleId && !role.retiredAt),
  );
  if (!dismissed.length) return null;
  const name = (id: string) => data.roles.find((role) => role.id === id)?.name ?? id;
  return (
    <section className="ui-section crew-dismissed" aria-label="Dismissed instruction updates">
      <AccordionSection
        triggerClassName="crew-disclosure-trigger"
        heading={
          <>
            Kept your instructions <span className="ui-count">{dismissed.length}</span>
          </>
        }
      >
        <ul className="ui-tray crew-retired-list">
          {dismissed.map((update) => (
            <li key={update.roleId} className="ui-row">
              <RoleAvatar agentRole={update.roleId} />
              <span className="crew-row-copy">
                <strong>{name(update.roleId)}</strong>
                <span className="ui-row-meta">
                  A newer default from {update.changes.at(-1)?.date ?? 'this release'} is still
                  available.
                </span>
              </span>
              <Button className="button small" onClick={() => onReview(update.roleId)}>
                Compare<span className="sr-only"> {name(update.roleId)}’s instructions</span>
              </Button>
            </li>
          ))}
        </ul>
      </AccordionSection>
    </section>
  );
};
