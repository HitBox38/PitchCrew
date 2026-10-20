import { launchBlocker, packetNeedsReview } from './helpers.ts';
import type { CardDetailsModel } from './types.ts';

export const jobNextAction = (model: CardDetailsModel) => {
  const { card, brief, data, run, agents, openApplication, setTab, runRole, act } = model;
  const goBrief = () => openApplication('brief');
  const launch = (label: string, perform: () => void, roleId = runRole) => ({
    label,
    perform,
    hint: launchBlocker(data, roleId),
    disabled: !!launchBlocker(data, roleId),
    roleId,
  });
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
  if (card.owner)
    return {
      label: 'Work in progress',
      hint: 'Wait for the job’s active work to finish.',
      disabled: true,
      perform: () => {},
    };
  if (
    [
      'submitted',
      'screening',
      'interviewing',
      'offer',
      'rejected',
      'ghosted',
      'withdrawn',
    ].includes(card.state)
  )
    return {
      label: 'Update outcome',
      hint: 'Keep your application history up to date.',
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
      label: 'Continue brief review',
      hint: 'Confirm the complete brief and requirements before drafting.',
      perform: goBrief,
    };
  if (!brief.loaded.context)
    return {
      label: 'Prepare brief',
      hint: 'Extract the job brief or prepare it manually.',
      perform: goBrief,
    };
  if (card.state === 'lead')
    return launch('Evaluate fit', () =>
      act(`/cards/${card.id}/run`, { roleId: runRole }, 'Fit evaluation started'),
    );
  if (!brief.confirmed)
    return {
      label: 'Review brief',
      hint: 'Confirm the current brief before preparing your application.',
      perform: goBrief,
    };
  if (
    brief.draft.requirements.some(
      (entry) => entry.required && entry.personal && !entry.answer.trim(),
    )
  )
    return {
      label: 'Answer requirements',
      hint: 'Your personal answers are needed before the application can pass review.',
      perform: goBrief,
    };
  if (['shortlisted', 'changes_requested'].includes(card.state))
    return launch(
      'Draft application',
      () => {
        void brief.startDraft();
      },
      brief.roleId,
    );
  if (card.state === 'in_review' || packetNeedsReview(card))
    return card.packet
      ? launch(
          'Review packet',
          () => {
            void brief.reviewPacket();
          },
          brief.reviewer?.id,
        )
      : {
          label: 'View application',
          hint: 'No packet is available to review.',
          perform: () => openApplication('documents'),
        };
  if (card.state === 'agreed')
    return {
      label: 'Prepare export',
      hint: 'Choose formats, then review the exact documents in Inbox.',
      perform: () => openApplication('export'),
    };
  if (card.state === 'awaiting_approval')
    return model.exported
      ? {
          label: 'Record manual submission',
          hint: 'Record this only after you have applied.',
          perform: () =>
            act(
              `/cards/${card.id}/move`,
              { state: 'submitted' },
              'Recorded your manual submission',
            ),
        }
      : {
          label: 'Open approval inbox',
          hint: 'Review the exact documents before export.',
          perform: model.openInbox,
        };
  return {
    label: 'View application',
    hint: 'Review the job’s application progress.',
    perform: () => setTab('application'),
  };
};
