import {
  crewToolLabelsFor,
  toolLabel,
  userControlPauseLabel,
  type ComputerApproval,
  type Run,
} from '@pitchcrew/core';
import {
  browserActionAllowed,
  browserActionAsked,
  browserActionDone,
  browserActionPublic,
  browserStepLabels,
} from '@pitchcrew/core/browser-action-labels';
import { findRun } from '@pitchcrew/board';
import { findEntity } from '../queue/queries.ts';
import { randomUUID } from 'node:crypto';
import { recordChatActivity } from '../chat-activity.ts';
import type { CrewContext } from '../types.ts';
import type { ToolFailure } from './failures.ts';
import { crewToolDetail } from './tool-details.ts';

/**
 * Browser steps in the words of the tray instead of "Performing browser action": "Asked to click
 * “Learn more”", "Clicked “Learn more”", "Read the page". Labels name elements, never typed or
 * chosen values (activity carries no browser inputs).
 */
/**
 * Each browser action is one row: the row that asked for an approval becomes the row that carries
 * it out ("Asked to click …" → "Click …" → "Clicked …"), keyed by approval in memory only. An
 * execution claims the row while it runs, so an overlapping duplicate call gets its own row and
 * cannot overwrite the outcome; the row returns only if the call ends still waiting for the user.
 */
const actionRows = new WeakMap<CrewContext, Map<string, string>>();
const rowsFor = (context: CrewContext) => {
  let rows = actionRows.get(context);
  if (!rows) actionRows.set(context, (rows = new Map()));
  return rows;
};

/** Browser calls that keep their start words when they finish. */
const plainBrowserSteps: Readonly<Record<string, string>> = {
  computer_wait: browserStepLabels.wait,
  computer_tabs: browserStepLabels.tabs,
  assess_form: browserStepLabels.assess,
  capture_submission: browserStepLabels.capture,
};

const browserStep = (
  context: CrewContext,
  action: string,
  data: Record<string, unknown> | undefined,
):
  | {
      start: string;
      done: (result: unknown) => string | undefined;
      /** An existing row this call continues. */
      row?: string;
      /** Called with the result and row once the call succeeds. */
      settled?: (result: unknown, row: string) => void;
      /** The step's label when the user declined the request it carries out. */
      declined?: string;
    }
  | undefined => {
  if (action === 'computer_inspect')
    return { start: browserStepLabels.inspect, done: () => browserStepLabels.inspected };
  if (action === 'computer_request')
    return {
      start: browserStepLabels.request,
      done: (result) => {
        const approval = (result as { approval?: ComputerApproval } | undefined)?.approval;
        if (!approval) return undefined;
        // The server approved it without asking: under the user's browser mode or a site grant.
        return approval.automatic
          ? browserActionAllowed(approval.action, approval.page, approval.mode)
          : browserActionAsked(approval.action, approval.page);
      },
      settled: (result, row) => {
        const approval = (result as { approval?: ComputerApproval } | undefined)?.approval;
        if (!approval) return;
        const rows = rowsFor(context);
        rows.set(approval.id, row);
        // Requests are decided one at a time; a few stale entries are all that can build up.
        for (const key of [...rows.keys()].slice(0, -50)) rows.delete(key);
      },
    };
  if (Object.hasOwn(plainBrowserSteps, action))
    return { start: plainBrowserSteps[action]!, done: () => undefined };
  if (action !== 'computer_execute') return undefined;
  const approval =
    typeof data?.approvalId === 'string'
      ? findEntity<ComputerApproval>(context, 'computer_approval', data.approvalId)
      : undefined;
  if (!approval) return { start: 'Performing browser action', done: () => undefined };
  const plain = browserActionPublic(approval.action, approval.page);
  const rows = rowsFor(context);
  const row = rows.get(approval.id);
  rows.delete(approval.id);
  return {
    start: plain,
    row,
    settled: (result, id) => {
      if ((result as { status?: string } | undefined)?.status === 'pending')
        rows.set(approval.id, id);
    },
    declined: `You declined to ${plain.charAt(0).toLowerCase()}${plain.slice(1)}`,
    done: (result) =>
      (result as { status?: string } | undefined)?.status === 'pending'
        ? `Waited for your OK to ${plain.charAt(0).toLowerCase()}${plain.slice(1)}`
        : browserActionDone(approval.action, approval.page),
  };
};

/** Chat turns and deep-review stages show tool activity in a transcript. */
const hasTranscript = (run: Run | undefined): run is Run =>
  !!run && (run.mode === 'chat' || !!run.deepReviewId);

/**
 * Records a crew tool call as a step: verb first in the tense of its outcome ("Reading profile",
 * "Read profile", "Couldn't read profile"), with its kind, an allowlisted detail and, once it
 * failed, the classified reason. Returns the finisher the gateway calls with that outcome.
 */
export const observeChatTool = (
  context: CrewContext,
  token: string,
  action: string,
  data?: Record<string, unknown>,
) => {
  try {
    const capability = context.capabilities.get(token);
    // Discovery/bootstrap and non-chat capabilities have no transcript activity.
    if (!capability || action.endsWith('_access') || action === 'report_progress') return () => {};
    const run = findRun(context.board, capability.runId);
    if (!hasTranscript(run)) return () => {};
    const step = browserStep(context, action, data);
    const labels = crewToolLabelsFor(action);
    const detail = step ? undefined : crewToolDetail(context, capability, run, action, data);
    const row = {
      id: step?.row ?? `tool-${randomUUID()}`,
      kind: 'tool' as const,
      tool: labels.tool,
      ...(detail ? { detail } : {}),
    };
    recordChatActivity(
      context,
      capability.runId,
      { ...row, label: step?.start ?? labels.running, status: 'running' },
      { latest: !!step?.row },
    );
    return (failure?: ToolFailure, result?: unknown) => {
      try {
        // A takeover stops the agent's browser call, or the gateway waited out the user's control
        // without acting ({ status: 'manual' }): it paused for the user, it neither failed nor ran.
        const paused = failure
          ? failure.reason === 'user_control'
          : (result as { status?: string } | undefined)?.status === 'manual';
        // The user's own decision, not a broken browser: shown as what they chose.
        const declined = failure?.reason === 'declined' && !!step?.declined;
        const status = paused ? 'interrupted' : failure && !declined ? 'failed' : 'completed';
        const label = paused
          ? userControlPauseLabel
          : declined
            ? step!.declined!
            : step
              ? (!failure && step.done(result)) || step.start
              : toolLabel(labels, status);
        recordChatActivity(context, capability.runId, {
          ...row,
          label,
          status,
          ...(status === 'failed' && failure?.message ? { error: failure.message } : {}),
        });
        if (!failure && !paused) step?.settled?.(result, row.id);
      } catch {
        /* Activity must never change a tool's result or error. */
      }
    };
  } catch {
    return () => {};
  }
};
