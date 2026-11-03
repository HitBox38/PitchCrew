import { useId } from 'react';
import { Switch } from '@pitchcrew/design-system/switch';
import type { SkillEditorModel } from '../types.ts';

export const SkillDelivery = ({
  includeInEveryRun,
  setIncludeInEveryRun,
  working,
  loading,
}: SkillEditorModel) => {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-label font-semibold">
          Include in every run
        </label>
        <p id={`${id}-help`} className="skills-assign-note">
          Keep these instructions present for every request. When off, agents can read them when
          relevant. Selecting the skill in a message includes it for that request.
        </p>
      </div>
      <Switch
        id={id}
        aria-describedby={`${id}-help`}
        checked={includeInEveryRun}
        onCheckedChange={setIncludeInEveryRun}
        disabled={working || loading}
      />
    </div>
  );
};
