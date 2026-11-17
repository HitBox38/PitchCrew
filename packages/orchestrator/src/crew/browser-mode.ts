import {
  browserModeSchema,
  type BrowserMode,
  type ChatRequest,
  type Conversation,
  type Role,
  type Run,
} from '@pitchcrew/core';
import { findRun } from '@pitchcrew/board';
import { findEntity } from './queue/queries.ts';
import type { CrewContext } from './types.ts';

/**
 * The browser mode a run's browser binds with; the browser keeps it for the rest of the run.
 *
 * Scheduled routines and messages from external MCP apps browse in Supervised, and so does
 * everything that follows from them: crew follow-ups and answer continuations share their chain
 * (`rootRunId ?? id`), rooted at the run that started it or at the chat request it was queued
 * with (every queued message, including a routine attached to a job).
 *
 * A chain whose start can no longer be found fails closed to Supervised.
 *
 * Otherwise the run's frozen configuration decides, so a later override or default change never
 * raises a started run; runs saved before configuration snapshots use the conversation override,
 * then the agent default. A mode this version does not know fails closed to Supervised.
 */
export const effectiveBrowserMode = (context: CrewContext, run: Run): BrowserMode => {
  const chainId = run.rootRunId ?? run.id;
  const root = findRun(context.board, chainId);
  // A deep review whose job the user picked from a question is rooted at the run that asked,
  // which the original request started.
  const request =
    findEntity<ChatRequest>(context, 'chat_request', chainId) ??
    findEntity<ChatRequest>(context, 'chat_request', root?.requestId);
  const conversation = findEntity<Conversation>(context, 'conversation', run.threadId);
  // A chain whose start is gone (its request was deleted with its conversation) can no longer
  // show it was not a routine or an external message, so it fails closed.
  const orphaned = (!!run.rootRunId && !root && !request) || (!!root?.requestId && !request);
  if (
    orphaned ||
    run.routineId ||
    root?.routineId ||
    request?.routine ||
    request?.external ||
    conversation?.kind === 'routine'
  )
    return 'supervised';
  const role = run.configuration?.role ?? context.board.get<Role>('role', run.roleId);
  const chosen = run.configuration
    ? role.browserMode
    : (conversation?.configurations[role.id]?.browserMode ?? role.browserMode);
  const parsed = browserModeSchema.safeParse(chosen);
  return parsed.success ? parsed.data : 'supervised';
};
