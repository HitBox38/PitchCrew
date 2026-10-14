import { Button } from '@/components/ui/button/components/Button.tsx';
import { BriefActions } from './components/BriefActions.tsx';
import { FlaggedSource } from './components/FlaggedSource.tsx';
import { BriefFields } from './components/BriefFields.tsx';
import { BriefSummary } from './components/BriefSummary.tsx';
import { RequirementFields } from './components/RequirementFields.tsx';
import { useApplicationBrief } from './hooks/useApplicationBrief.ts';
import type { ApplicationBriefProps } from './types.ts';

export function ApplicationBriefReview(props: ApplicationBriefProps) {
  const model = useApplicationBrief(props);
  const { draft, setDraft, loaded, editing, confirmed, disabled } = model;
  return (
    <section
      className="form my-4 grid gap-3 rounded-lg border p-4"
      aria-label="Application brief review"
    >
      <div>
        <h3>Application brief</h3>
        <p className="quiet">
          {confirmed
            ? 'Confirmed for drafting. Changes need another confirmation and packet review.'
            : 'Review the complete brief before an agent prepares your application.'}
        </p>
      </div>
      <p className="quiet">
        Source visibility is unknown. Review requested topics and unusual instructions against the
        employer’s page.
      </p>
      {props.card.packet &&
      (!props.card.packetReview ||
        props.card.packetReview.contextRevision !== props.card.applicationContext?.revision) ? (
        <p className="form-error">
          This packet needs a review against the confirmed brief before another export or browser
          submission.
        </p>
      ) : null}
      {model.error ? (
        <p className="form-error" role="alert">
          {model.error}
        </p>
      ) : null}
      {loaded?.context && !editing ? <BriefSummary value={draft} /> : null}
      <FlaggedSource items={draft.flagged} />
      {editing ? (
        <>
          <BriefFields value={draft.brief} change={(brief) => setDraft({ ...draft, brief })} />
          <RequirementFields
            value={draft.requirements}
            change={(requirements) => setDraft({ ...draft, requirements })}
          />
          <Button
            className="h-auto min-h-9.5 justify-self-start py-2 whitespace-normal"
            disabled={disabled}
            onClick={() => {
              void model.confirm();
            }}
          >
            Confirm complete brief and requirements
          </Button>
        </>
      ) : (
        <Button
          className="justify-self-start"
          variant="outline"
          disabled={disabled}
          onClick={() => model.setEditing(true)}
        >
          {loaded?.context ? 'Review or edit brief' : 'Prepare brief manually'}
        </Button>
      )}
      <BriefActions model={model} card={props.card} />
    </section>
  );
}
