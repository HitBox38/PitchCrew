import type {
  ChatRequest,
  Role,
  RuntimeConfiguration,
  RuntimeId,
  Snapshot,
  WorkQueueView,
} from '@pitchcrew/core';
import { runtimeLabels } from './labels.ts';
import { isolatesApplications } from './runtimes.ts';

// Why an agent cannot start the work assigned to it, whatever the work slots say. The server makes
// the same agent checks once a slot frees (`requestProblem`): it holds the job queue with the
// reason and gives the slot to the next queue, so such work never waits for a slot, only for the
// user.

export type StartBlockKind = 'paused' | 'unavailable' | 'isolation' | 'signin';

/**
 * The title for each reason an agent cannot start ("Paused"), as the roster card and the Queue
 * cell say it. Only a board action needs a runtime that isolates application work.
 */
export const startBlockTitles: Record<StartBlockKind, string> = {
  paused: 'Paused',
  signin: 'Needs sign-in',
  unavailable: 'Runtime unavailable',
  isolation: 'Needs an isolated runtime',
};

export type StartBlock = {
  kind: StartBlockKind;
  title: string;
  /** What starts the work, after "Starts" or "All 3 start": "after you resume Scout in Crew". */
  until: string;
};

/** Whether the latest sign-in check of this runtime (and model) found no account. */
export const signInMissing = (
  data: Pick<Snapshot, 'runtimeMaintenance'>,
  runtime: RuntimeId,
  model: string,
) =>
  data.runtimeMaintenance?.authentication.some(
    (entry) =>
      entry.runtime === runtime &&
      (entry.model === model || entry.model === '') &&
      entry.result.status === 'missing',
  ) ?? false;

/**
 * Why `role` cannot start work now, in the server's order: it is paused or retired, the runtime its
 * work would use is not installed (a runtime missing from this workspace counts, as the roster
 * says), that runtime cannot isolate the application work an `application` request (a board
 * action) runs, or it waits for sign-in. `configuration` is a conversation's own runtime choice for
 * the agent. Undefined while it can start.
 */
export const startBlock = (
  data: Pick<Snapshot, 'runtimes' | 'runtimeMaintenance'>,
  role: Role,
  configuration: Partial<RuntimeConfiguration> = {},
  application = false,
): StartBlock | undefined => {
  const block = (kind: StartBlockKind, until: string) => ({
    kind,
    title: startBlockTitles[kind],
    until,
  });
  if (!role.enabled || role.retiredAt)
    return block('paused', `after you resume ${role.name} in Crew`);
  const runtime = configuration.runtime ?? role.runtime;
  const name = runtimeLabels[runtime] ?? runtime;
  if (!data.runtimes.some((entry) => entry.id === runtime && entry.available))
    return block('unavailable', `once you install ${name} in Settings`);
  if (application && !isolatesApplications(data.runtimes, runtime))
    return block(
      'isolation',
      `once you choose an isolated application runtime for ${role.name} in Crew`,
    );
  if (signInMissing(data, runtime, configuration.model ?? role.model))
    return block('signin', `once you sign in to ${name} in Settings`);
  return undefined;
};

/**
 * Why the agent of one queued request delivery cannot start it. Board actions and routines run on
 * the agent's own settings; other requests on the conversation's choice for that agent. A board
 * action also needs a runtime that isolates application work.
 */
export const requestStartBlock = (
  data: Pick<Snapshot, 'roles' | 'runtimes' | 'runtimeMaintenance' | 'conversations'>,
  request: Pick<ChatRequest, 'boardAction' | 'routine' | 'threadId'>,
  roleId: string,
): StartBlock | undefined => {
  const role = data.roles.find((entry) => entry.id === roleId);
  if (!role) return undefined;
  const own = !!request.boardAction || !!request.routine;
  const conversation = own
    ? undefined
    : data.conversations?.find((entry) => entry.id === request.threadId);
  return startBlock(data, role, conversation?.configurations?.[roleId], !!request.boardAction);
};

/**
 * Why a request cannot start: the first of its waiting agents that cannot, named by `roleId`. One
 * stopped agent holds the whole request, as the server checks every queued delivery.
 */
export const firstStartBlock = (
  data: Pick<Snapshot, 'roles' | 'runtimes' | 'runtimeMaintenance' | 'conversations'>,
  request: Pick<ChatRequest, 'boardAction' | 'routine' | 'threadId' | 'deliveries'>,
) => {
  for (const delivery of request.deliveries) {
    if (delivery.status !== 'queued') continue;
    const block = requestStartBlock(data, request, delivery.roleId);
    if (block) return { ...block, roleId: delivery.roleId };
  }
  return undefined;
};

/** Why a queue's next request cannot start. */
export const headStartBlock = (
  data: Pick<Snapshot, 'roles' | 'runtimes' | 'runtimeMaintenance' | 'conversations'>,
  queue: Pick<WorkQueueView, 'requests'>,
) => (queue.requests[0] ? firstStartBlock(data, queue.requests[0]) : undefined);
