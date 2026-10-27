import { useJobWork } from '@/components/JobWorkStatus/hooks/useJobWork.ts';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';
import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import type { useApplicationBrief } from '../hooks/useApplicationBrief.ts';
import type { Card } from '@pitchcrew/core';

export const BriefActions = ({
  model,
  card,
}: {
  model: ReturnType<typeof useApplicationBrief>;
  card: Card;
}) => {
  const { pending } = useJobWork(card);
  const extracting = pending?.path.endsWith('/application-context/extract');
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
          aria-busy={!!extracting}
          variant="outline"
          disabled={model.disabled || !model.roleId || model.editing}
          onClick={() => {
            void model.extract();
          }}
        >
          {extracting ? (
            <LoaderCircle
              size={14}
              className="spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : null}
          {extracting ? 'Starting extraction…' : 'Extract from source'}
        </Button>
      </div>
      <p className="quiet">
        Extraction prepares a brief for your review. It does not confirm the brief or start
        drafting.
      </p>
    </AccordionSection>
  );
};
