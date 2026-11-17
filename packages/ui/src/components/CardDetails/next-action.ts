import { jobStep, outcomeHints, postSubmissionStates, type JobStep } from '@/lib/job-step.ts';
import { cardPacketStage } from '@/ClayInterface/packet-guidance.ts';
import { stateLabels } from '@/lib/labels.ts';
import type { CardState } from '@pitchcrew/core';
import { transitions } from '@pitchcrew/core/states';
import { dockRecordsOutcome, launchBlocker } from './helpers.ts';
import { exportFormatLabels } from './export-format.ts';
import type { CardDetailsModel } from './types.ts';

/** What the dock is showing, so its line and material follow the same decision as its buttons. */
export type JobNowKind =
  | JobStep
  | 'pending'
  | 'running'
  | 'waiting'
  | 'uncertain'
  | 'starting'
  | 'owner'
  | 'closed'
  | 'brief-loading'
  | 'brief-editing'
  | 'choose'
  | 'preparing'
  | 'view';

export type JobNextAction = {
  label: string;
  hint?: string | null;
  perform: () => void;
  disabled?: boolean;
  roleId?: string;
  /** A launch that setup (agent, runtime or profile notes) blocks; the hint names what to fix. */
  blocked?: boolean;
  /** A stable name for actions other surfaces defer to, independent of the label's wording. */
  intent?: 'extract-brief' | 'write-brief';
  /** Shown as a clay button: a live run's Cancel, or an equal alternative. */
  secondary?: boolean;
  /** Shown as a quiet text button: navigation or a less common route. */
  quiet?: boolean;
  /** Starts work or moves the card, so it waits while a request is in flight even when quiet. */
  acts?: boolean;
  /** Other valid moves at this step, shown before the primary action. */
  alternates?: JobNextAction[];
  /** Equal choices with no default (recorded outcomes); they replace the primary button. */
  choices?: JobNextAction[];
  kind?: JobNowKind;
};

/** Manual status changes the user can record after applying; workflow moves stay with the crew. */
const workflowMoves = new Set<CardState>([
  'drafting',
  'in_review',
  'agreed',
  'awaiting_approval',
  'submitted',
  'shortlisted',
]);
export const outcomeChoices = (model: CardDetailsModel): JobNextAction[] =>
  transitions[model.card.state]
    .filter((state) => !workflowMoves.has(state))
    .map((state) => ({
      label: stateLabels[state],
      perform: () =>
        model.act(`/cards/${model.card.id}/move`, { state }, `Moved to ${stateLabels[state]}`),
    }));

const confirmsWhat = (form: CardDetailsModel['brief']['draft']['form']) =>
  form?.status === 'inspected'
    ? `Uses this brief, its requirements and all ${form.fields.length} form fields for the draft.`
    : 'Uses this brief and its requirements for the draft.';

export const jobNextAction = (model: CardDetailsModel): JobNextAction => {
  const { card, brief, data, run, agents, openApplication, setTab, runRole, act } = model;
  const goBrief = () => openApplication('brief');
  const launch = (label: string, perform: () => void, roleId = runRole): JobNextAction => ({
    label,
    perform,
    hint: launchBlocker(data, roleId),
    disabled: !!launchBlocker(data, roleId),
    blocked: !!launchBlocker(data, roleId),
    roleId,
    acts: true,
  });
  if (model.work?.pending)
    return {
      kind: 'pending',
      label: model.work.pending.label,
      hint: model.work.pending.targetState
        ? 'Saving the job’s new stage.'
        : 'Your request is being prepared.',
      disabled: true,
      perform: () => {},
    };
  const uncertain = card.submissionAttempts?.findLast((attempt) => attempt.status === 'uncertain');
  if (run)
    return {
      kind: 'running',
      label: 'Cancel run',
      hint: run.message,
      perform: () => act(`/runs/${run.id}/cancel`),
      secondary: true,
      alternates: run.threadId
        ? [
            {
              label: 'Open chat',
              quiet: true,
              perform: () => model.openChat(run.threadId!, run.id),
            },
          ]
        : undefined,
    };
  const waiting = agents.find(({ run, handedOff }) => run.status === 'waiting' && !handedOff)?.run;
  if (waiting?.threadId) {
    // Only a pending User input request has an answer to give; other waits are read in the chat.
    const asked = data.userInputs?.some(
      (input) => input.runId === waiting.id && input.status === 'pending',
    );
    return {
      kind: 'waiting',
      label: asked ? 'Answer in job chat' : 'Open job chat',
      hint: 'Your agent is waiting for you.',
      perform: () => model.openChat(waiting.threadId!, waiting.id),
    };
  }
  if (uncertain) {
    const resolve = (confirmed: boolean) => () =>
      act(
        `/submissions/${uncertain.id}/resolve`,
        confirmed
          ? { confirmed, reason: 'User verified captured website submission confirmation' }
          : {
              confirmed,
              reason: 'User verified no submission occurred; browser actions may resume',
            },
        confirmed ? 'Submission verified' : 'Outcome resolved; submission may be attempted again',
      );
    // Only captured confirmation evidence can be verified here; anything else is checked in Activity.
    if (!uncertain.confirmation)
      return {
        kind: 'uncertain',
        label: 'Check submission evidence',
        hint: 'Pitchcrew couldn’t tell whether the application was received.',
        perform: () => setTab('activity'),
      };
    return {
      kind: 'uncertain',
      label: 'I verified submission',
      hint: 'Pitchcrew couldn’t tell whether the application was received.',
      perform: resolve(true),
      disabled: model.working,
      alternates: [
        { label: 'Other evidence', quiet: true, perform: () => setTab('activity') },
        {
          label: 'I verified it was not submitted',
          secondary: true,
          disabled: model.working,
          perform: resolve(false),
        },
      ],
    };
  }
  if (model.work?.starting)
    return {
      kind: 'starting',
      label: model.work.spinning ? 'Starting agent…' : 'View queued action',
      hint: model.work.reason || 'This job already has queued work.',
      disabled: model.work.spinning,
      perform: model.work.spinning ? () => {} : model.openQueue,
    };
  if (card.owner)
    return {
      kind: 'owner',
      label: 'Work in progress',
      hint: 'Wait for the job’s active work to finish.',
      disabled: true,
      perform: () => {},
    };
  if (postSubmissionStates.has(card.state)) {
    // An offer's lone withdrawal stays in Activity's Change… menu rather than leading the dock.
    const choices = dockRecordsOutcome(card.state) ? outcomeChoices(model) : [];
    return {
      kind: transitions[card.state].length ? 'outcome' : 'closed',
      label: choices.length ? 'Record outcome' : 'Add a lesson',
      hint: outcomeHints[card.state] ?? 'Keep your application history up to date.',
      perform: () => setTab('activity'),
      ...(choices.length ? { choices } : { quiet: true }),
    };
  }
  if (!brief.loaded)
    return {
      kind: 'brief-loading',
      label: brief.error ? 'Retry brief' : 'Review brief',
      hint: brief.error || 'Loading application brief…',
      disabled: !brief.error,
      perform: brief.error ? brief.retry : goBrief,
    };
  if (brief.editing)
    // Drafting confirmation covers the exact brief, so it is only offered where the brief is visible.
    return model.tab === 'application' && model.sections?.includes('brief')
      ? {
          kind: 'brief-editing',
          label: 'Confirm brief',
          hint: brief.confirmationHint || confirmsWhat(brief.draft.form),
          disabled: brief.confirmDisabled,
          perform: () => void brief.confirm(),
        }
      : {
          kind: 'brief-editing',
          label: 'Review brief',
          hint: 'Your brief edits are open in Application.',
          perform: goBrief,
        };
  const evaluate = (label: string) =>
    launch(label, () =>
      act(`/cards/${card.id}/run`, { roleId: runRole }, 'Fit evaluation started'),
    );
  const shortlist: JobNextAction = {
    label: 'Shortlist',
    acts: true,
    perform: () => act(`/cards/${card.id}/move`, { state: 'shortlisted' }, 'Shortlisted'),
  };
  // The loaded context also compares the source revision, which the snapshot cannot.
  const step = jobStep(card, {
    hasBrief: !!brief.loaded.context,
    briefConfirmed: brief.confirmed,
    formMissing: !!card.url && !brief.draft.form,
    missingAnswers: brief.draft.requirements.some(
      (entry) => entry.required && entry.personal && !entry.answer.trim(),
    ),
    exported: model.exported,
  });
  const at = (action: JobNextAction): JobNextAction => ({ kind: step ?? 'view', ...action });
  switch (step) {
    case 'prepare-brief': {
      // A lead's dock keeps one glaze: Shortlist stays a quiet alternative.
      const lead = card.state === 'lead' ? [{ ...shortlist, quiet: true }] : [];
      const extract = () => void Promise.resolve(brief.extract()).catch(() => {});
      // The dock names the agent the brief column has chosen.
      const extractor =
        brief.available?.find((role) => role.id === brief.roleId)?.name ?? 'An agent';
      // An older score without a brief still answers "worth applying?", so Shortlist leads.
      if (card.state === 'lead' && typeof card.fit === 'number' && brief.available?.length)
        return {
          ...shortlist,
          kind: 'shortlist',
          hint: 'Shortlist it to start an application. The brief comes next.',
          alternates: [
            {
              label: 'Extract brief',
              intent: 'extract-brief',
              quiet: true,
              acts: true,
              disabled: brief.disabled,
              perform: extract,
            },
          ],
        };
      // With an application agent, the dock extracts the brief itself; otherwise it opens the editor.
      if (brief.available?.length && brief.roleId)
        return at({
          label: 'Extract brief',
          intent: 'extract-brief',
          hint:
            card.state === 'lead'
              ? `${extractor} reads the posting and prepares a brief so the fit can be checked.`
              : `${extractor} reads the posting and prepares a brief for you to confirm.`,
          disabled: brief.disabled,
          perform: extract,
          alternates: [
            {
              label: 'Write it myself',
              intent: 'write-brief',
              quiet: true,
              perform: () => {
                goBrief();
                brief.setEditing(true);
              },
            },
            ...lead,
          ],
        });
      return at({
        label: 'Prepare brief',
        hint:
          card.state === 'lead'
            ? 'Extract or write the job brief so the fit can be checked.'
            : 'Extract the job brief or prepare it manually.',
        perform: goBrief,
        ...(lead.length ? { alternates: lead } : {}),
      });
    }
    case 'confirm-brief':
      // Opens the brief ready to confirm: editors and the whole form list, Confirm in the dock.
      // With the brief already on screen, the ellipsis says one more step follows.
      return at({
        label:
          model.tab === 'application' && model.sections?.includes('brief')
            ? 'Confirm brief…'
            : 'Review brief',
        hint: null,
        perform: () => {
          goBrief();
          brief.setEditing(true);
        },
      });
    case 'evaluate-fit':
      return at({ ...evaluate('Evaluate fit'), alternates: [{ ...shortlist, quiet: true }] });
    case 'shortlist': {
      const again = evaluate('Evaluate again');
      return at({
        ...shortlist,
        // The header carries Fit; the ledger's Brief row carries the review it still needs.
        hint: [
          'Shortlisting only moves it on your board. You confirm the brief before any draft.',
          again.hint,
        ]
          .filter(Boolean)
          .join(' '),
        alternates: [{ ...again, hint: undefined, quiet: true }],
      });
    }
    case 'check-form':
      // An agent with form tools inspects directly; checking it yourself opens the brief editor.
      if (brief.formRoleId && brief.formAgents?.length)
        return at({
          label: 'Inspect application form',
          hint: 'An agent opens the form and lists its required fields and files.',
          disabled: brief.disabled,
          perform: () => void Promise.resolve(brief.inspectForm()).catch(() => {}),
          alternates: [
            {
              label: 'I’ll check it myself',
              quiet: true,
              perform: () => {
                goBrief();
                brief.setEditing(true);
              },
            },
          ],
        });
      return at({
        label: 'Check application form',
        hint: 'Check required fields and files before drafting, or choose to check the form yourself.',
        perform: goBrief,
      });
    case 'answer-requirements':
      return at({
        label: 'Answer requirements',
        hint: 'Your personal answers are needed before the application can pass review.',
        perform: goBrief,
      });
    case 'draft':
    case 'revise': {
      const action = launch(
        step === 'revise' ? 'Revise application' : 'Draft application',
        () => {
          void Promise.resolve(brief.startDraft()).catch(() => {});
        },
        brief.roleId,
      );
      // Requested changes without a saved packet: an earlier draft produced nothing to revise.
      // The dock shows the first request; the full list is in Reviews, one quiet click away.
      const requests = card.feedback?.length
        ? [{ label: 'Read requests', quiet: true, perform: () => openApplication('reviews') }]
        : [];
      return at(
        card.state === 'changes_requested' && !card.packet && !action.hint
          ? { ...action, hint: 'No packet has been saved yet. This drafts the first packet.' }
          : { ...action, ...(requests.length ? { alternates: requests } : {}) },
      );
    }
    case 'review':
      return at(
        card.packet
          ? launch(
              'Review packet',
              () => {
                void Promise.resolve(brief.reviewPacket()).catch(() => {});
              },
              brief.reviewer?.id,
            )
          : {
              label: 'View application',
              hint: 'No packet is available to review.',
              perform: () => openApplication('documents'),
            },
      );
    case 'export': {
      // The dock requests exactly the files it names; Change opens the format and layout choices.
      const { format, layout, requesting, request } = model.exportChoices;
      const files =
        format === 'markdown'
          ? 'Markdown copies only'
          : `${exportFormatLabels[format]}, ${layout === 'plain' ? 'plain text' : 'formatted'}, plus Markdown copies`;
      const open = model.tab === 'application' && model.sections?.includes('export');
      return at({
        label: 'Request export approval',
        hint: `${files}. You approve the exact files in Decisions. Nothing is sent.`,
        disabled: requesting || model.busy,
        perform: request,
        ...(open
          ? {}
          : {
              alternates: [
                { label: 'Change files', quiet: true, perform: () => openApplication('export') },
              ],
            }),
      });
    }
    case 'apply': {
      // The files and the posting live in the Decisions handoff, as on the Board card; recording
      // stays a separate, secondary move for after the user has really applied.
      // The dock names where it goes: applying happens in the Decisions handoff, not in the sheet.
      const continueApplication = { label: 'Open in Decisions', perform: model.openInbox };
      if (cardPacketStage(card, data.approvals) === 'preparing')
        return {
          ...continueApplication,
          kind: 'preparing',
          hint: 'This application was handed to an agent. Check its progress in Decisions. Nothing is submitted until you approve the final click.',
        };
      return at({
        ...continueApplication,
        // The line says the files are saved and the button where to apply; this keeps the warning.
        hint: 'Nothing has been sent. Record a submission only after you’ve applied.',
        alternates: [
          {
            label: 'Record manual submission',
            quiet: true,
            acts: true,
            perform: () =>
              act(
                `/cards/${card.id}/move`,
                { state: 'submitted' },
                'Recorded your manual submission',
              ),
          },
        ],
      });
    }
    case 'approve':
      return cardPacketStage(card, data.approvals) === 'choose'
        ? {
            kind: 'choose',
            label: 'Open in Decisions',
            hint: 'Packet approved. Choose how to apply in Decisions. Nothing has been sent.',
            perform: model.openInbox,
          }
        : at({
            label: 'Open in Decisions',
            hint: 'Review the exact documents before export.',
            perform: model.openInbox,
          });
    default:
      return {
        kind: step === 'drafting' ? 'drafting' : 'view',
        label: 'View application',
        // Reached only without a run, owner or queued work, so drafting is not actually running.
        hint:
          step === 'drafting'
            ? 'No drafting run is active. The job chat and Activity show the last result.'
            : 'Review the job’s application progress.',
        perform: () => setTab('application'),
      };
  }
};
