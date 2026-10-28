import { sourceArguments } from '../process.ts';
import { adapters } from '@pitchcrew/adapters';
import { digestPacket, assertConfirmedContext } from '@pitchcrew/board';
import {
  draftingCard,
  workflowSeat,
  type Card,
  type ProfileFile,
  type Role,
  type Run,
  type RunContext,
} from '@pitchcrew/core';
import { randomUUID, createHash } from 'node:crypto';
import { launchProblem, QueueBusyError } from '../crew/queue/admission.ts';
import { join } from 'node:path';
import type { CrewContext } from '../crew/types.ts';
import { runConfiguration } from '../crew/pipeline/snapshots.ts';
import { guideForRun } from './writing.ts';
import { inspectPacketDocuments } from './documents.ts';
import { beginAiRun } from '../telemetry/ai.ts';
import { endQuestionTurn } from '../crew/user-input/lifecycle.ts';
import { relatedConversation } from '../crew/conversations.ts';
import { applicationUserAnswers } from '../crew/application-context/answers.ts';

const stagePrepared = async (
  context: CrewContext,
  parent: Run,
  role: Role,
  purpose: 'application-draft' | 'application-review',
  profile: ProfileFile[],
  request: string,
  signal: AbortSignal,
) => {
  signal.throwIfAborted();
  if (!role.enabled) throw new Error(`${role.name} is unavailable for document correction.`);
  if (!adapters[role.runtime].applicationIsolation)
    throw new Error('This runtime cannot isolate document correction.');
  const card = context.board.get<Card>('card', parent.cardId!);
  const revision = assertConfirmedContext(card).revision;
  const run: Run = {
    cardId: card.id,
    contextRevision: revision,
    threadId: relatedConversation(
      context,
      'application',
      card.id,
      role.id,
      card.id,
      `${card.company}: Application work`,
    ).id,
    mode: 'workflow',
    documentRepair: true,
    profileDigest:
      parent.profileDigest ?? createHash('sha256').update(JSON.stringify(profile)).digest('hex'),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    writingGuide: parent.writingGuide ?? guideForRun(context),
    id: randomUUID(),
    roleId: role.id,
    runtime: role.runtime,
    purpose,
    writingCorrectionId: undefined,
    rootRunId: parent.rootRunId ?? parent.id,
    configuration: runConfiguration(role, context.skills(role.id)),
    inputPacketDigest: digestPacket(card.id, card.packet!),
    status: 'running',
    message:
      purpose === 'application-draft'
        ? 'Correcting document layout'
        : 'Rechecking corrected packet',
  };
  context.board.record('run', run, role.id, run.message);
  const token = randomUUID();
  context.capabilities.set(token, { runId: run.id, roleId: role.id, cardId: card.id });
  context.controllers.set(run.id, context.controllers.get(parent.id)!);
  const directory = join(context.directory, 'roles', role.id, 'runs', run.id);
  const ai = beginAiRun(context.diagnostics, 'workflow');
  try {
    await context.writeRunInstructions(directory, role, run.configuration!.skills);
    const launch: RunContext = {
      card: draftingCard(card, purpose),
      purpose,
      request,
      profile,
      role,
      skills: run.configuration!.skills,
      writingGuide: run.writingGuide,
      userAnswers: applicationUserAnswers(context, card.id, role.id, purpose),
      packetRules: context.packetRules.current().rules,
      directory,
      signal,
      deadline: { expiresAt: new Date(parent.startedAt).getTime() + 30 * 60_000 },
      mcp: {
        command: process.execPath,
        args: sourceArguments(context.mcpEntry),
        env: { PITCHCREW_RUN_TOKEN: token, PITCHCREW_DAEMON_URL: context.daemonUrl },
      },
      onMessage: () => {},
    };
    const result = await ai.observe(() => adapters[role.runtime].run(launch), signal);
    if (endQuestionTurn(context, run)) {
      if (purpose === 'application-draft')
        context.board.record(
          'card',
          {
            ...context.board.get<Card>('card', card.id),
            state: 'changes_requested',
            packetReview: undefined,
          },
          'orchestrator',
          'Writer is waiting for an answer during document correction',
        );
      return false;
    }
    signal.throwIfAborted();
    if (purpose === 'application-draft')
      context.board.record(
        'card',
        { ...context.board.get<Card>('card', card.id), state: 'drafting', packetReview: undefined },
        'orchestrator',
        'Started the single document correction pass',
      );
    await context.applyResult(card.id, role, result, profile, signal, {
      contextRevision: revision,
      runId: run.id,
    });
    context.board.record(
      'run',
      {
        ...run,
        status: 'completed',
        finishedAt: new Date().toISOString(),
        outputPacketDigest: digestPacket(card.id, context.board.get<Card>('card', card.id).packet!),
      },
      role.id,
      'Finished document correction stage',
    );
    return true;
  } catch (error) {
    ai.fail(error);
    context.board.record(
      'run',
      {
        ...run,
        status: signal.aborted ? 'cancelled' : 'failed',
        finishedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Document correction failed.',
      },
      role.id,
      'Document correction stopped',
    );
    throw error;
  } finally {
    const outcome = context.board.get<Run>('run', run.id).status;
    ai.finish(outcome === 'running' ? 'failed' : outcome);
    context.capabilities.delete(token);
    context.controllers.delete(run.id);
  }
};

const stage = (...args: Parameters<typeof stagePrepared>) => {
  const [context, parent, role] = args;
  return context.runtimeMaintenance.guard(role, () => {
    const thread = relatedConversation(
      context,
      'application',
      parent.cardId!,
      role.id,
      parent.cardId!,
      'Application work',
    );
    const problem = launchProblem(context, {
      isolated: true,
      cardId: parent.cardId,
      threadId: thread.id,
      roleId: role.id,
      rootRunId: parent.rootRunId ?? parent.id,
    });
    if (problem) throw new QueueBusyError(problem);
    return stagePrepared(...args);
  });
};

export const documentReviewCycle = async (
  context: CrewContext,
  parent: Run,
  profile: ProfileFile[],
  signal: AbortSignal,
) => {
  let card = context.board.get<Card>('card', parent.cardId!);
  if (!card.packet) return;
  let check = await inspectPacketDocuments(context.directory, card.packet);
  signal.throwIfAborted();
  const alreadyCorrected = context.board
    .list<Run>('run')
    .some(
      (run) =>
        run.documentRepair &&
        run.cardId === card.id &&
        (run.rootRunId ?? run.id) === (parent.rootRunId ?? parent.id),
    );
  if (check.repairable.length && !alreadyCorrected) {
    const roles = context.board.list<Role>('role');
    const available = (r: Role) => r.enabled && adapters[r.runtime].applicationIsolation;
    const candidates = [
      ...roles.filter((r) => r.id === parent.roleId),
      ...roles.filter((r) => r.id !== parent.roleId),
    ];
    const writer = candidates.find((r) => available(r) && workflowSeat(r) === 'writer');
    const reviewer = candidates.find((r) => available(r) && workflowSeat(r) === 'reviewer');
    if (writer && reviewer) {
      if (
        !(await stage(
          context,
          parent,
          writer,
          'application-draft',
          profile,
          `Make one focused formatting correction, preserving every verified fact and required answer. Address these advisory document findings: ${JSON.stringify(check.repairable)}. Return the full packet.`,
          signal,
        ))
      )
        return;
      if (
        !(await stage(
          context,
          parent,
          reviewer,
          'application-review',
          profile,
          'Independently recheck the corrected full packet. Do not start another correction cycle.',
          signal,
        ))
      )
        return;
      card = context.board.get<Card>('card', parent.cardId!);
      check = await inspectPacketDocuments(context.directory, card.packet!);
      signal.throwIfAborted();
    } else check.warnings.push('Document correction needs an enabled Writer and Reviewer.');
  }
  const latest = context.board.get<Card>('card', card.id);
  context.board.updateCard(
    card.id,
    {
      feedback: [
        ...new Set([
          ...latest.feedback,
          ...check.errors,
          ...check.warnings.map((w) => `Warning: ${w}`),
        ]),
      ],
      ...(check.errors.length ? { packetReview: undefined } : {}),
    },
    'orchestrator',
    'Recorded document verification findings',
  );
  if (check.errors.length)
    context.board.record(
      'card',
      {
        ...context.board.get<Card>('card', card.id),
        state: 'changes_requested',
        packetReview: undefined,
      },
      'orchestrator',
      'Document verification needs attention',
    );
};
