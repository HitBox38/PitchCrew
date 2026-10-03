import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import { ScheduleFields } from '@/RoutinesPage/components/ScheduleFields.tsx';
import type { RoutineDraft } from '@/RoutinesPage/types.ts';
import type { StepProps } from '../types.ts';

export function RoutineStep({ draft, changeDraft, data }: StepProps) {
  const change = (patch: Partial<RoutineDraft>) =>
    changeDraft({ routine: { ...draft.routine, ...patch } });
  return (
    <div className="flex flex-col gap-5">
      <p className="quiet">
        Start work through chat whenever you need it, or add a scheduled action. You can add more
        routines later.
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
            <input
              required
              maxLength={120}
              value={draft.routine.name}
              onChange={(event) => change({ name: event.target.value })}
              placeholder="Weekly check-in"
            />
          </label>
          <label>
            What should the agent do?
            <textarea
              required
              rows={4}
              maxLength={8000}
              value={draft.routine.content}
              onChange={(event) => change({ content: event.target.value })}
              placeholder="Describe the task and what it should report back to you."
            />
          </label>
          <label>
            Attached job
            <select
              value={draft.routine.cardId}
              onChange={(event) => change({ cardId: event.target.value })}
            >
              <option value="">No job attached</option>
              {data.cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.company} — {card.title}
                </option>
              ))}
            </select>
          </label>
          <ScheduleFields draft={draft.routine} change={change} />
          <p className="quiet">
            Routines run while Pitchcrew is open, using this agent’s current settings and skills.
            Runs can spend provider tokens. Browser and export approvals still apply.
          </p>
          {!draft.role.enabled && draft.routine.enabled ? (
            <p className="quiet">This routine waits until the agent is enabled.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
