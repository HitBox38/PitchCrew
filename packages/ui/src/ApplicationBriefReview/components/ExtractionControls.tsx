import { useJobWork } from '@/components/JobWorkStatus/hooks/useJobWork.ts';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { FormSelect } from '@/FormSelect/index.tsx';
import type { useApplicationBrief } from '../hooks/useApplicationBrief.ts';
import type { Card } from '@pitchcrew/core';

export const ExtractionControls = ({
  model,
  card,
  label,
}: {
  model: ReturnType<typeof useApplicationBrief>;
  card: Card;
  /** Without a label only the agent choice shows; the dock holds the Extract brief button. */
  label?: string;
}) => {
  const { pending } = useJobWork(card);
  const extracting = pending?.path.endsWith('/application-context/extract');
  const select = (
    <FormSelect
      label="Application agent"
      value={model.roleId}
      onValueChange={model.setRoleId}
      options={model.available.map((role) => ({ value: role.id, label: role.name }))}
      className={label ? undefined : 'brief-agent-row'}
    />
  );
  // Without a label the dock holds Extract brief; the column keeps only the agent choice.
  if (!label) return select;
  return (
    <div className="flex flex-wrap items-end gap-2">
      {select}
      <Button
        aria-busy={!!extracting}
        variant="ghost"
        size="sm"
        disabled={model.disabled || !model.roleId || model.editing}
        onClick={() => {
          void model.extract();
        }}
      >
        {extracting ? (
          <LoaderCircle size={14} className="spin motion-reduce:animate-none" aria-hidden="true" />
        ) : null}
        {extracting ? 'Starting extraction…' : label}
      </Button>
    </div>
  );
};
