import type { ChatRequest, Run, Snapshot } from '@pitchcrew/core';
import { boardActionLabels } from '@pitchcrew/core/states';
import { wordCut } from './text.ts';

type Purpose = NonNullable<Run['purpose']>;

/** What a workflow run is doing now, for rail rows, the table's Queue cell and the Crew lens. */
export const runPurposeLabels: Record<Purpose, string> = {
  fit: 'Evaluating fit',
  'packet-evaluation': 'Reevaluating with the packet',
  'application-draft': 'Drafting the packet',
  'application-review': 'Reviewing the packet',
  'deep-review': 'Deep resume review',
  'source-extraction': 'Reading the job source',
};

/** A finished run's verb, before its subject: "Scout evaluated fit for Lumen Labs". */
const doneVerbs: Record<Purpose, string> = {
  fit: 'evaluated fit for',
  'packet-evaluation': 'reevaluated',
  'application-draft': 'drafted',
  'application-review': 'reviewed',
  'deep-review': 'finished a deep review of',
  'source-extraction': 'read the job source for',
};

/** A run's work as a noun, after the agent: "Scout’s fit evaluation". */
const workNouns: Record<Purpose, string> = {
  fit: 'fit evaluation',
  'packet-evaluation': 'packet reevaluation',
  'application-draft': 'draft',
  'application-review': 'review',
  'deep-review': 'deep review',
  'source-extraction': 'brief extraction',
};

/** An agent's display name; "An agent" for a role the snapshot no longer has. */
export const roleName = (data: Pick<Snapshot, 'roles'>, id: string | null | undefined) =>
  data.roles.find((role) => role.id === id)?.name ?? 'An agent';

const routineOf = (run: Run, data: Snapshot) =>
  run.routineId ? data.routines.find((routine) => routine.id === run.routineId) : undefined;

const conversationOf = (run: Run, data: Snapshot) =>
  run.threadId ? data.conversations?.find((item) => item.id === run.threadId) : undefined;

/** The user's own words in a row beside the job: at most two narrow lines, cut at a word. */
const requestChars = 48;

/**
 * A request's work in words, for rows that show it beside its job and its agent (Up next, Working
 * now, a failed request's ask): a board action's label; for the request an answer queues, whose
 * text is the agent's own instruction, "Continue after your answer" (chat says the same, naming the
 * agent, which these rows already show); a summary before continuing; a scheduled routine's name;
 * else the user's words, cut at a word; else its files.
 */
export const requestLabel = (request: ChatRequest, data: Pick<Snapshot, 'routines'>) => {
  if (request.boardAction) return boardActionLabels[request.boardAction];
  if (request.userInputId) return 'Continue after your answer';
  if (request.summarize) return 'Summarize before continuing';
  const routine = request.routine
    ? data.routines.find((entry) => entry.id === request.routine?.routineId)
    : undefined;
  if (routine) return routine.name;
  if (request.content.trim()) return wordCut(request.content, requestChars);
  const files = request.attachments.length;
  return files ? `${files} attached ${files === 1 ? 'file' : 'files'}` : 'Request';
};

/**
 * What a run is doing: its workflow purpose, else its routine's name, else the request it answers
 * (`requestLabel`), else whose crew follow-up it runs ("Follow-up for Reviewer", as Up next and a
 * failed follow-up say it; the follow-up's own instruction is long and a one-line row would cut it
 * mid-word). The workspace snapshot blanks a settled request's text, so only live runs show it; a
 * finished chat run falls through to its conversation's title.
 */
export const runAction = (run: Run, data: Snapshot) => {
  if (run.purpose) return runPurposeLabels[run.purpose];
  const routine = routineOf(run, data);
  if (routine) return routine.name;
  const request = run.requestId
    ? data.chatRequests?.find((item) => item.id === run.requestId)
    : undefined;
  if (request && !request.compact) return requestLabel(request, data);
  const task = run.taskId ? data.tasks.find((item) => item.id === run.taskId) : undefined;
  if (task) {
    const parent = data.runs.find((item) => item.id === task.parentRunId);
    return `Follow-up for ${roleName(data, parent?.roleId)}`;
  }
  return conversationOf(run, data)?.title ?? 'Chat';
};

/** What a run works on: its job's company, else its routine, else its conversation, else "Chat". */
export const runSubject = (run: Run, data: Snapshot) => {
  const card = run.cardId ? data.cards.find((item) => item.id === run.cardId) : undefined;
  return card?.company ?? routineOf(run, data)?.name ?? conversationOf(run, data)?.title ?? 'Chat';
};

/** The agent, and whose crew follow-up it is running: "Writer for Reviewer". */
export const runAgentLabel = (run: Run, data: Snapshot) => {
  const name = roleName(data, run.roleId);
  const task = run.taskId ? data.tasks.find((item) => item.id === run.taskId) : undefined;
  const parent = task ? data.runs.find((item) => item.id === task.parentRunId) : undefined;
  return parent && parent.roleId !== run.roleId
    ? `${name} for ${roleName(data, parent.roleId)}`
    : name;
};

/** The verb a "since" line uses for a finished run; its subject follows. */
export const runDone = (run: Pick<Run, 'purpose' | 'routineId'>) =>
  run.purpose ? doneVerbs[run.purpose] : run.routineId ? 'ran' : 'replied in';

/**
 * A run's work as a noun for lines that name the agent first ("Scout’s fit evaluation on Lumen
 * Labs failed"): its purpose, its routine's name ("routine" once the routine is deleted, since the
 * snapshot leaves deleted routines out while their runs keep the id), a crew follow-up or a reply.
 */
export const runWork = (run: Run, data: Snapshot) => {
  if (run.purpose) return workNouns[run.purpose];
  if (run.routineId) return routineOf(run, data)?.name ?? 'routine';
  return run.taskId ? 'follow-up' : 'reply';
};
