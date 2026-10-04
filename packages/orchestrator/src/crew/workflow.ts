import { requireRole } from './roles.ts';
import { assertProfileReady } from '../profile-sources/mutation.ts';
import { runConfiguration, packetDigest } from './pipeline/snapshots.ts';
import { adapters } from '@pitchcrew/adapters';
import {
  runResultSchema,
  workflowSeat,
  type AgentTask,
  type Card,
  type ProfileFile,
  type Role,
  type RoleId,
  type Run,
  type RunResult,
} from '@pitchcrew/core';
import { readProfile, warningFeedback, writePacket } from '@pitchcrew/packet';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { CrewContext } from './types.ts';

export async function startRun(
  this: CrewContext,
  cardId: string,
  roleId: RoleId,
  task?: AgentTask,
): Promise<Run> {
  if (this.closing) throw new Error('The daemon is stopping.');
  assertProfileReady(this);
  if (this.profileWriting) throw new Error('Wait for the profile update to finish.');
  const profileRevision = this.profileRevision;
  if (this.configuring.has(roleId)) throw new Error('Wait for this role’s settings update.');
  if (this.board.list<Run>('run').some((r) => r.roleId === roleId && r.status === 'running'))
    throw new Error('Wait for this role’s chat turn to finish.');
  const role = requireRole(this, roleId);
  const skills = this.skills(roleId);
  const card = this.board.get<Card>('card', cardId);
  if (!role.enabled) throw new Error('Enable this role in Crew first.');
  if (!this.runtimes.find((r) => r.id === role.runtime)?.available)
    throw new Error('This runtime is not installed. Check Crew settings.');
  if (this.board.hasActiveRun(cardId))
    throw new Error('This application already has an active run.');
  const seat = workflowSeat(role);
  if (seat === 'chat') throw new Error('This role has no application workflow seat. Use chat.');
  const allowed = {
    scout: ['lead'],
    writer: ['shortlisted', 'changes_requested'],
    reviewer: ['in_review'],
  };
  if (!allowed[seat].includes(card.state))
    throw new Error(`The ${roleId} cannot run on a card in ${card.state}.`);
  const profile = await readProfile(this.directory);
  if (!profile.length) throw new Error('Add your profile notes before starting the crew.');
  const run: Run = {
    id: randomUUID(),
    cardId,
    roleId,
    runtime: role.runtime,
    configuration: runConfiguration(role, skills),
    inputPacketDigest: packetDigest(card),
    status: 'running',
    message: 'Starting role…',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    mode: 'workflow',
    ...(task ? { rootRunId: task.rootRunId, taskId: task.id } : {}),
  };
  const dir = join(this.directory, 'roles', roleId, 'runs', run.id);
  await this.writeRunInstructions(dir, role, skills);
  if (
    this.closing ||
    this.profileWriting ||
    this.profileRevision !== profileRevision ||
    (task &&
      (this.board.get<AgentTask>('task', task.id).status !== 'queued' ||
        !this.taskPermissionsAllow(task))) ||
    this.board.hasActiveRun(cardId) ||
    this.board.get<Card>('card', cardId).state !== card.state ||
    this.configuring.has(roleId) ||
    JSON.stringify(requireRole(this, roleId)) !== JSON.stringify(role) ||
    this.board.list<Run>('run').some((r) => r.roleId === roleId && r.status === 'running')
  )
    throw new Error('This application changed or was claimed by another run. Refresh and retry.');
  const controller = new AbortController();
  this.controllers.set(run.id, controller);
  const token = randomUUID();
  this.capabilities.set(token, { runId: run.id, cardId, roleId });
  if (seat === 'writer') this.board.move(cardId, 'drafting', 'orchestrator');
  this.board.updateCard(
    cardId,
    { owner: roleId },
    'orchestrator',
    `${role.name} claimed this application`,
  );
  this.board.record('run', run, 'orchestrator', `Started ${role.name} on ${role.runtime}`);
  const context = {
    card: this.board.get<Card>('card', cardId),
    role,
    skills,
    request: task?.content,
    profile,
    packetRules: this.packetRules.current().rules,
    directory: dir,
    mcp: {
      command: process.execPath,
      args: ['--import', import.meta.resolve('tsx'), this.mcpEntry],
      env: { PITCHCREW_RUN_TOKEN: token, PITCHCREW_DAEMON_URL: this.daemonUrl },
    },
    signal: controller.signal,
    onMessage: (message: string) => {
      const current = this.board.get<Run>('run', run.id);
      if (current.status === 'running')
        this.board.record('run', { ...current, message }, roleId, message);
    },
  };
  void adapters[role.runtime]
    .run(context)
    .then(async (result) => {
      if (controller.signal.aborted) throw new Error('Run cancelled.');
      await this.applyResult(cardId, role, result, profile, controller.signal);
      this.board.record(
        'run',
        {
          ...run,
          status: 'completed',
          outputPacketDigest: packetDigest(this.board.get<Card>('card', cardId)),
          message: `${role.name} finished`,
          finishedAt: new Date().toISOString(),
        },
        roleId,
        `${role.name} completed its work`,
      );
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : 'Run failed.';
      this.board.record(
        'run',
        {
          ...run,
          status: controller.signal.aborted ? 'cancelled' : 'failed',
          message,
          finishedAt: new Date().toISOString(),
        },
        roleId,
        message,
      );
      const current = this.board.get<Card>('card', cardId);
      if (current.state === 'drafting')
        this.board.move(cardId, 'changes_requested', roleId, 'Draft failed; retry the writer');
    })
    .finally(async () => {
      await this.computer.stop(run.id);
      this.board.updateCard(cardId, { owner: null }, 'orchestrator', 'Released application');
      this.controllers.delete(run.id);
      this.capabilities.delete(token);
      this.finishTask(run);
      void this.drainTasks();
    });
  return run;
}
export async function applyResult(
  this: CrewContext,
  cardId: string,
  role: Role,
  data: unknown,
  profile: ProfileFile[] = [],
  signal?: AbortSignal,
): Promise<void> {
  const result: RunResult = runResultSchema.parse(data);
  if (result.role !== workflowSeat(role)) throw new Error('Result role does not match the run.');
  if (result.role === 'scout') {
    this.board.updateCard(
      cardId,
      { fit: result.fit, feedback: result.reasons },
      role.id,
      'Evaluated job fit',
    );
  }
  if (result.role === 'writer') {
    const check = await this.packetRules.check(result.packet, profile);
    if (check.errors.length) throw new Error(check.errors.join('\n'));
    await writePacket(this.directory, cardId, result.packet);
    if (signal?.aborted) throw new Error('Run cancelled.');
    this.board.updateCard(
      cardId,
      { packet: result.packet, feedback: warningFeedback(check.warnings) },
      role.id,
      'Drafted application packet',
    );
    this.board.move(cardId, 'in_review', role.id);
  }
  if (result.role === 'reviewer') {
    const card = this.board.get<Card>('card', cardId);
    if (!card.packet) throw new Error('No packet to review.');
    const check = await this.packetRules.check(card.packet, profile);
    // Reviewer feedback still fails the review; rule warnings are shown without blocking.
    const passed = result.passed && check.errors.length === 0 && result.feedback.length === 0;
    const feedback = [
      ...new Set([...check.errors, ...result.feedback, ...warningFeedback(check.warnings)]),
    ];
    this.board.updateCard(
      cardId,
      { feedback },
      role.id,
      passed ? 'Reviewer approved the packet' : 'Reviewer requested changes',
    );
    this.board.move(cardId, passed ? 'agreed' : 'changes_requested', role.id);
  }
}
export function cancelRun(this: CrewContext, id: string): void {
  const controller = this.controllers.get(id);
  if (!controller) throw new Error('This run is no longer active.');
  controller.abort();
  const run = this.board.get<Run>('run', id);
  const rootRunId = run.rootRunId ?? run.id;
  for (const sibling of this.board
    .list<Run>('run')
    .filter((r) => (r.rootRunId ?? r.id) === rootRunId)) {
    this.controllers.get(sibling.id)?.abort();
    this.streamingMessages.delete(sibling.id);
  }
  this.publishChat();
  for (const task of this.board
    .list<AgentTask>('task')
    .filter((t) => t.rootRunId === rootRunId && t.status === 'queued'))
    this.board.record(
      'task',
      { ...task, status: 'cancelled', error: 'The run chain was stopped by the user.' },
      'user',
      'Cancelled queued crew task',
    );
}
