import { jobStep, outcomeHints, postSubmissionStates } from '@/lib/job-step.ts';
import { cardPacketStage } from '@/ClayInterface/packet-guidance.ts';
import { launchBlocker } from './helpers.ts';
import { exportFormatLabels } from './export-format.ts';
import type { CardDetailsModel } from './types.ts';

export type JobNextAction = {
  label: string;
  hint?: string | null;
  perform: () => void;
  disabled?: boolean;
  roleId?: string;
  /** Shown as an outline button: a live run's Cancel. */
  secondary?: boolean;
  /** Other valid moves at this step, shown before the primary action. */
  alternates?: JobNextAction[];
};

export const jobNextAction = (model: CardDetailsModel): JobNextAction => {
  const { card, brief, data, run, agents, openApplication, setTab, runRole, act } = model;
  const goBrief = () => openApplication('brief');
  const launch = (label: string, perform: () => void, roleId = runRole): JobNextAction => ({
    label,
    perform,
    hint: launchBlocker(data, roleId),
    disabled: !!launchBlocker(data, roleId),
    roleId,
  });
  if (model.work?.pending)
    return {
      label: model.work.pending.label,
      hint: model.work.pending.targetState
        ? 'Saving the job’s new stage.'
        : 'Your request is being prepared.',
      disabled: true,
      perform: () => {},
    };
  const uncertainty = card.submissionAttempts?.some((attempt) => attempt.status === 'uncertain');
  if (run)
    return {
      label: 'Cancel run',
      hint: run.message,
      perform: () => act(`/runs/${run.id}/cancel`),
      secondary: true,
    };
  const waiting = agents.find(({ run }) => run.status === 'waiting')?.run;
  if (waiting?.threadId)
    return {
      label: 'Answer in job chat',
      hint: 'Your agent is waiting for you.',
      perform: () => model.openChat(waiting.threadId!, waiting.id),
    };
  if (uncertainty)
    return {
      label: 'Verify submission',
      hint: 'The submission outcome needs your verification.',
      perform: () => setTab('activity'),
    };
  if (model.work?.starting)
    return {
      label: model.work.spinning ? 'Starting agent…' : 'View queued action',
      hint: model.work.reason || 'This job already has queued work.',
      disabled: model.work.spinning,
      perform: model.work.spinning ? () => {} : model.openQueue,
    };
  if (card.owner)
    return {
      label: 'Work in progress',
      hint: 'Wait for the job’s active work to finish.',
      disabled: true,
      perform: () => {},
    };
  if (postSubmissionStates.has(card.state))
    return {
      label: 'Update outcome',
      hint: outcomeHints[card.state] ?? 'Keep your application history up to date.',
      perform: () => setTab('activity'),
    };
  if (!brief.loaded)
    return {
      label: brief.error ? 'Retry brief' : 'Review brief',
      hint: brief.error || 'Loading application brief…',
      disabled: !brief.error,
      perform: brief.error ? brief.retry : goBrief,
    };
  if (brief.editing)
    return {
      label: 'Confirm brief',
      hint: brief.confirmationHint || 'Confirms the complete brief and requirements shown above.',
      disabled: brief.confirmDisabled,
      perform: () => void brief.confirm(),
    };
  const evaluate = (label: string) =>
    launch(label, () =>
      act(`/cards/${card.id}/run`, { roleId: runRole }, 'Fit evaluation started'),
    );
  const shortlist: JobNextAction = {
    label: 'Shortlist',
    perform: () => act(`/cards/${card.id}/move`, { state: 'shortlisted' }, 'Shortlisted'),
  };
  // A lead's extracted brief is confirmed before drafting, not before fit; keep it reachable.
  const reviewBrief: JobNextAction[] =
    card.state === 'lead' && !brief.confirmed ? [{ label: 'Review brief', perform: goBrief }] : [];
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
  switch (step) {
    case 'prepare-brief':
      return {
        label: 'Prepare brief',
        hint:
          card.state === 'lead'
            ? 'Extract or write the job brief so the fit can be checked.'
            : 'Extract the job brief or prepare it manually.',
        perform: goBrief,
        ...(card.state === 'lead' ? { alternates: [shortlist] } : {}),
      };
    case 'confirm-brief':
      return {
        label: 'Review brief',
        hint: 'Confirm the current brief before preparing your application.',
        perform: goBrief,
      };
    case 'evaluate-fit':
      return { ...evaluate('Evaluate fit'), alternates: [shortlist, ...reviewBrief] };
    case 'shortlist': {
      const again = evaluate('Evaluate again');
      return {
        ...shortlist,
        hint: [
          `Fit ${card.fit}/100. Shortlist it to start your application, or evaluate again.`,
          reviewBrief.length ? 'You confirm the brief before drafting.' : '',
          again.hint,
        ]
          .filter(Boolean)
          .join(' '),
        alternates: [{ ...again, hint: undefined }, ...reviewBrief],
      };
    }
    case 'check-form':
      return {
        label: 'Inspect application form',
        hint: 'Check required fields and files before drafting, or choose to check the form yourself.',
        perform: goBrief,
      };
    case 'answer-requirements':
      return {
        label: 'Answer requirements',
        hint: 'Your personal answers are needed before the application can pass review.',
        perform: goBrief,
      };
    case 'draft':
    case 'revise': {
      const action = launch(
        'Draft application',
        () => {
          void Promise.resolve(brief.startDraft()).catch(() => {});
        },
        brief.roleId,
      );
      // Requested changes without a saved packet: an earlier draft produced nothing to revise.
      return card.state === 'changes_requested' && !card.packet && !action.hint
        ? { ...action, hint: 'No packet has been saved yet. This drafts the first packet.' }
        : action;
    }
    case 'review':
      return card.packet
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
          };
    case 'export':
      // Once the choices are visible, the footer requests exactly them, like the inline button.
      if (model.tab === 'application' && model.sections.includes('export')) {
        const { format, layout, requesting, request } = model.exportChoices;
        const files =
          format === 'markdown'
            ? 'Markdown copies only'
            : `${exportFormatLabels[format]}, ${layout === 'plain' ? 'plain text' : 'formatted'}, plus Markdown copies`;
        return {
          label: 'Request export approval',
          hint: `${files}. You approve the exact files in Decisions. Nothing is sent.`,
          disabled: requesting || model.busy,
          perform: request,
        };
      }
      return {
        label: 'Prepare export',
        hint: 'Choose formats, then review the exact documents in Decisions.',
        perform: () => openApplication('export'),
      };
    case 'apply': {
      // The files and the posting live in the Decisions handoff, as on the Board card; recording
      // stays a separate, secondary move for after the user has really applied.
      const continueApplication = { label: 'Continue application', perform: model.openInbox };
      if (cardPacketStage(card, data.approvals) === 'preparing')
        return {
          ...continueApplication,
          hint: 'This application was handed to an agent. Check its progress in Decisions. Nothing is submitted until you approve the final click.',
        };
      return {
        ...continueApplication,
        hint: 'Files saved on this computer. Nothing has been sent. Apply from Decisions, then record your submission only after you have applied.',
        alternates: [
          {
            label: 'Record manual submission',
            perform: () =>
              act(
                `/cards/${card.id}/move`,
                { state: 'submitted' },
                'Recorded your manual submission',
              ),
          },
        ],
      };
    }
    case 'approve':
      return cardPacketStage(card, data.approvals) === 'choose'
        ? {
            label: 'Continue application',
            hint: 'Packet approved. Choose how to apply in Decisions. Nothing has been sent.',
            perform: model.openInbox,
          }
        : {
            label: 'Open in Decisions',
            hint: 'Review the exact documents before export.',
            perform: model.openInbox,
          };
    default:
      return {
        label: 'View application',
        hint: 'Review the job’s application progress.',
        perform: () => setTab('application'),
      };
  }
};
