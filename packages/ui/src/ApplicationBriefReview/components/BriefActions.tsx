import { Button } from '@/components/ui/button/components/Button.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';
import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import type { useApplicationBrief } from '../hooks/useApplicationBrief.ts';
import type { Card } from '@pitchcrew/core';

export const BriefActions = ({
  model,
}: {
  model: ReturnType<typeof useApplicationBrief>;
  card: Card;
}) => {
  if (!model.available.length)
    return (
      <p className="quiet">
        Enable Codex, Claude Code or OpenCode in Crew to extract or draft. You can prepare a brief
        manually.
      </p>
    );
  return (
    <AccordionSection heading="Agent and source extraction">
      <div className="flex flex-wrap items-end gap-2 py-3">
        <FormSelect
          label="Application agent"
          value={model.roleId}
          onValueChange={model.setRoleId}
          options={model.available.map((role) => ({ value: role.id, label: role.name }))}
        />
        <Button
          variant="outline"
          disabled={model.disabled || !model.roleId || model.editing}
          onClick={() => {
            void model.extract();
          }}
        >
          Extract from source
        </Button>
      </div>
      <p className="quiet">
        Extraction prepares a brief for your review. It does not confirm the brief or start
        drafting.
      </p>
    </AccordionSection>
  );
};
