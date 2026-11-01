import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import { ScheduleFields } from '@/RoutinesPage/components/ScheduleFields.tsx';
import type { RoutineDraft } from '@/RoutinesPage/types.ts';
import type { StepProps } from '../types.ts';
import { FormSelect } from '@/FormSelect/index.tsx';
import { Input } from '@/components/ui/input/index.tsx';
import { Textarea } from '@/components/ui/textarea/index.tsx';

export const RoutineStep = ({ draft, changeDraft, data }: StepProps) => {
  const change = (patch: Partial<RoutineDraft>) =>
    changeDraft({ routine: { ...draft.routine, ...patch } });
  return (
    <div className="agent-wizard-step">
      <p className="optional">
        Optional. Give it a scheduled task now, or start work from chat and add routines later.
      </p>
      <label className="checkbox-label">
        <Checkbox
          aria-label="Add a first routine"
          checked={draft.scheduled}
          onCheckedChange={(scheduled) => changeDraft({ scheduled })}
        />
        Add a first routine
      </label>
      {draft.scheduled ? (
        <>
          <label>
            Routine name
            <Input
              required
              maxLength={120}
              value={draft.routine.name}
              onChange={(event) => change({ name: event.target.value })}
              placeholder="Weekly check-in"
            />
          </label>
          <label>
            What should the agent do?
            <Textarea
              required
              rows={4}
              maxLength={8000}
              value={draft.routine.content}
              onChange={(event) => change({ content: event.target.value })}
              placeholder="Describe the task and what it should report back to you."
            />
          </label>
          <FormSelect
            label="Attached job"
            value={draft.routine.cardId}
            onValueChange={(cardId) => change({ cardId })}
            options={[
              { value: '', label: 'No job attached' },
              ...data.cards.map((card) => ({
                value: card.id,
                label: `${card.company} — ${card.title}`,
              })),
            ]}
          />
          <ScheduleFields draft={draft.routine} change={change} />
          <p className="optional">
            Routines run while Pitchcrew is open, using this agent’s current settings and skills.
            Runs can spend provider tokens. Browser and export approvals still apply.
          </p>
          {!draft.role.enabled && draft.routine.enabled ? (
            <p className="optional">This routine waits until the agent is enabled.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
