import { Check, Hand, Square, X } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { browserActionTitles } from '@/ComputerApprovals/helpers.ts';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { BrowserControls } from './BrowserControls.tsx';
import { automaticSteps, formFillProgress, stepFieldLabel } from '../clay-states.ts';

/**
 * The steps this run took on its own on granted sites, from saved records only. On
 * an inspected form page the title counts filled fields; Stop is the conversation's existing Stop,
 * and Take control sits beside it as on every other tray.
 */
export const ClayAutomaticSteps = ({
  browserPanel,
  data,
  name,
  thread,
  action,
  working,
  control,
  nudged,
}: Pick<AgentBrowserProps, 'browserPanel' | 'data' | 'thread' | 'action' | 'working'> & {
  name: string;
  control: BrowserControl;
  nudged: boolean;
}) => {
  const session = browserPanel.session;
  const roleId = browserPanel.role?.id;
  const assessment = data.cards
    .find((card) => card.id === session?.cardId)
    ?.formAssessments?.at(-1);
  const steps = automaticSteps(data.computerApprovals, roleId, session?.runId);
  const progress = formFillProgress(
    data.computerApprovals,
    assessment,
    roleId,
    session?.runId,
    session?.url,
  );
  const running = data.runs.some((run) => run.id === session?.runId && run.status === 'running');
  return (
    <section className="clay-tray-state" aria-label="Automatic preparation">
      <div className="clay-tray-copy">
        <p className="clay-tray-title">
          <StatusBead status="running" />
          <strong>{progress ? 'Filling the form' : 'Automatic preparation'}</strong>
          <span>
            {progress ? `${progress.filled} of ${progress.total} fields` : `${name} · this run`}
          </span>
        </p>
        {steps.length ? (
          <ul className="clay-tray-steps">
            {steps.map((step) => (
              <li key={step.id} data-failed={step.status === 'failed' || undefined}>
                {step.status === 'failed' ? <X size={13} /> : <Check size={13} />}
                {stepFieldLabel(step, assessment) ?? browserActionTitles[step.action.kind]}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="clay-tray-note">
          <Hand size={13} aria-hidden="true" />
          {steps.length ? '' : 'On sites you grant, form answers and approved files fill in. '}
          Buttons, keys, dialogs and submitting still ask here.
        </p>
      </div>
      <BrowserControls
        browserPanel={browserPanel}
        thread={thread}
        control={control}
        nudged={nudged}
      />
      {running ? (
        <Button
          size="sm"
          variant="outline"
          disabled={working}
          title="Stops this run now. Waiting work pauses until you resume it."
          onClick={() => void action(`/conversations/${thread}/stop`, 'POST').catch(() => {})}
        >
          <Square size={11} fill="currentColor" aria-hidden="true" />
          Stop
        </Button>
      ) : null}
    </section>
  );
};
