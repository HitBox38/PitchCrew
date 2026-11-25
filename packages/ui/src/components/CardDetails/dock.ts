import { runtimeLabels, stateLabels } from '@/lib/labels.ts';
import { turnPreview } from './helpers.ts';
import type { JobNextAction, JobNowKind } from './next-action.ts';
import type { CardDetailsModel } from './types.ts';
import { jobWaitingKinds, type Decision } from '@/ClayInterface/signals.ts';

/**
 * The dock's material says whose move it is: `rest` is recessed (an agent, the queue or the
 * employer has it), `raised` is the user's move with one glazed action, `ask` is raised with the
 * ochre tint for a question or decision waiting on the user.
 */
export type DockMaterial = 'rest' | 'raised' | 'ask';
export type JobDock = {
  line: string;
  detail?: string | null;
  material: DockMaterial;
  tone?: 'plum' | 'ochre' | 'rose';
  live?: boolean;
  /** The previous run failed: shown as evidence beside the still-valid next action. */
  failure?: string;
};

const lines: Partial<Record<JobNowKind, string>> = {
  'prepare-brief': 'Start with a brief',
  'confirm-brief': 'Check the brief before drafting',
  'brief-editing': 'Confirm the brief before drafting',
  'check-form': 'Check the application form first',
  'answer-requirements': 'Add your answers to the brief',
  'evaluate-fit': 'Check how well you fit',
  draft: 'Ready to draft your application',
  revise: 'Ready to revise your application',
  drafting: 'No agent is drafting right now',
  review: 'Draft ready for Reviewer',
  export: 'Packet reviewed · ready to export',
  approve: 'Approve the exact files in Decisions',
  choose: 'Packet approved · choose how to apply',
  apply: 'Files saved · apply when you’re ready',
  preparing: 'An agent is preparing your application',
  'brief-loading': 'Loading the brief…',
  owner: 'Work in progress',
  view: 'Application in progress',
};
const outcomeLines: Partial<Record<string, string>> = {
  submitted: 'Heard back yet?',
  screening: 'How did screening go?',
  interviewing: 'How did the interviews go?',
  offer: 'You have an offer',
  ghosted: 'No reply yet',
};
const materials: Partial<Record<JobNowKind, DockMaterial>> = {
  pending: 'rest',
  running: 'rest',
  starting: 'rest',
  owner: 'rest',
  closed: 'rest',
  drafting: 'rest',
  preparing: 'rest',
  'brief-loading': 'rest',
  waiting: 'ask',
  uncertain: 'ask',
  approve: 'ask',
  choose: 'ask',
};

// The decision a dock step owns, as Decisions' `decisions()` lists it.
const decisionOwners: Partial<Record<JobNowKind, Decision['kind']>> = {
  'confirm-brief': 'brief',
  'brief-editing': 'brief',
  apply: 'packet',
};

/** The question a waiting agent is asking, for the dock to quote and answer in place. */
export const pendingQuestion = ({ agents, data }: CardDetailsModel) => {
  const agent = agents.find((item) => item.run.status === 'waiting' && !item.handedOff);
  const question = data.userInputs?.find(
    (input) => input.runId === agent?.run.id && input.status === 'pending',
  );
  return { agent, question };
};

const roleLine = (model: CardDetailsModel, roleId?: string) => {
  const role = roleId ? model.data.roles.find((item) => item.id === roleId) : undefined;
  if (!role) return null;
  const account = role.runtime === 'demo' ? 'No AI calls' : 'Your account';
  return `${role.name} · ${runtimeLabels[role.runtime]} · ${account}`;
};

/** One sentence for whose move it is, from the same decision that chose the dock's buttons. */
export const jobDock = (model: CardDetailsModel, next: JobNextAction): JobDock => {
  const { card, agents } = model;
  const kind = next.kind ?? 'view';
  // A step whose own decision waits on the user is ochre-tinted, by the header's and ledger's rule.
  const owned = decisionOwners[kind];
  const asks = owned !== undefined && jobWaitingKinds(card.id, model.data).has(owned);
  const material = materials[kind] ?? (asks ? 'ask' : 'raised');
  const failure =
    model.failed && !model.run && material !== 'rest' ? model.failed.message : undefined;
  const base = { material, failure, detail: next.hint ?? roleLine(model, next.roleId) };
  if (kind === 'pending') return { ...base, line: next.label, detail: next.hint };
  if (kind === 'running' && model.run) {
    const agent = agents.find((item) => item.run.id === model.run!.id);
    const preview = turnPreview(model.run);
    return {
      ...base,
      tone: 'plum',
      live: true,
      // A deep review runs several turns; the dock names the review rather than one agent's turn.
      line: `${model.run.deepReviewId ? 'Deep review · ' : ''}${agent?.name ?? 'An agent'} is working`,
      detail: preview.commentary ?? preview.status,
    };
  }
  if (kind === 'waiting') {
    const { agent, question } = pendingQuestion(model);
    const name = agent?.name ?? 'Your agent';
    return {
      ...base,
      tone: 'ochre',
      line: question ? `${name} asks: “${question.question}”` : `${name} is waiting for you`,
      // Only a question promises a continuation; other waits are explained in the chat.
      detail: question
        ? `${name} continues after you answer.`
        : 'Open the job chat to see what it needs.',
    };
  }
  if (kind === 'uncertain') {
    const attempt = card.submissionAttempts?.findLast((item) => item.status === 'uncertain');
    return {
      ...base,
      tone: 'ochre',
      line: 'Did the application go through?',
      detail: attempt?.evidence ? `The page said: “${attempt.evidence}”` : next.hint,
    };
  }
  if (next.blocked) return { ...base, line: 'Finish setup to continue', detail: next.hint };
  if (kind === 'starting')
    return { ...base, line: model.work.label || 'Agent queued', detail: next.hint };
  if (kind === 'preparing') return { ...base, tone: 'plum', line: lines.preparing! };
  if (kind === 'closed')
    return {
      ...base,
      line: `Closed as ${stateLabels[card.state].toLowerCase()}`,
      detail: 'Keep what you learned for your next application.',
    };
  if (kind === 'outcome')
    return {
      ...base,
      // An offer has nothing to record here: the decision is the user's, with the employer.
      ...(next.choices ? {} : { material: 'rest' as const }),
      line: outcomeLines[card.state] ?? 'Record what happened',
      detail: next.choices
        ? 'This only updates your board. The employer isn’t contacted.'
        : next.hint,
    };
  if (kind === 'revise' && card.feedback.length)
    return {
      ...base,
      line: `Reviewer asked for ${card.feedback.length} ${card.feedback.length === 1 ? 'change' : 'changes'}`,
      detail: card.feedback[0],
    };
  if (kind === 'review' && (card.state === 'agreed' || card.state === 'awaiting_approval'))
    return {
      ...base,
      line: 'Review the packet again',
      detail: 'It hasn’t been reviewed against the current brief.',
    };
  if (kind === 'shortlist') return { ...base, line: 'Worth applying?', detail: next.hint };
  if (kind === 'brief-loading' && model.brief.error)
    return { ...base, material: 'raised', tone: 'rose', line: 'The brief didn’t load' };
  return { ...base, line: lines[kind] ?? lines.view! };
};
