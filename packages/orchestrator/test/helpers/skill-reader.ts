import type { ChatRequest, Role, Run } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { confirmFixtureJob } from '../../../board/test/fixtures/application-context.ts';
import { runConfiguration } from '../../src/crew/pipeline/snapshots.ts';
import { cleanup, resources, setup } from './daemon.ts';

export const skillReaderFixture = async (port: number) => {
  const fixture = await setup(port);
  const service = fixture.daemon.service;
  const role = service.board.get<Role>('role', 'writer');
  const input = {
    name: 'Writer method',
    description: 'Use when tailoring a cover letter.',
    content: 'Preserve the full exact skill instructions. '.repeat(1000).trim(),
    scope: 'roles' as const,
    roleIds: ['writer'],
  };
  const skill = service.saveSkill(input);
  const other = service.saveSkill({
    ...input,
    name: 'Reviewer only',
    content: 'OTHER-ROLE-PRIVATE-INSTRUCTIONS',
    roleIds: ['reviewer'],
  });
  const run: Run = {
    id: `skill-reader-${randomUUID()}`,
    roleId: role.id,
    runtime: role.runtime,
    cardId: null,
    threadId: role.id,
    mode: 'chat',
    status: 'running',
    message: 'Read assigned skill instructions',
    configuration: runConfiguration(role, service.skills(role.id)),
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  service.board.record('run', run, role.id, 'Skill reader fixture');
  service.controllers.set(run.id, new AbortController());
  service.capabilities.set(run.id, { runId: run.id, roleId: role.id, cardId: null });
  const updateRun = (changes: Partial<Run>) => {
    const updated = { ...service.board.get<Run>('run', run.id), ...changes };
    service.board.record('run', updated, role.id, 'Update skill reader fixture');
    service.capabilities.set(run.id, {
      runId: run.id,
      roleId: updated.roleId,
      cardId: updated.cardId,
    });
    return updated;
  };
  const isolated = (purpose: Run['purpose'] = 'application-draft') => {
    const card = service.createCard({
      company: 'Fictional skill employer',
      title: 'Engineer',
      description: 'RAW-POSTING-INSTRUCTIONS-MUST-STAY-HIDDEN',
    });
    confirmFixtureJob(service.board, card.id);
    return updateRun({
      cardId: card.id,
      mode: 'workflow',
      purpose,
      contextRevision: service.board.get<typeof card>('card', card.id).applicationContext!.revision,
    });
  };
  const summary = () => {
    const request: ChatRequest = {
      id: randomUUID(),
      threadId: role.id,
      messageId: randomUUID(),
      content: 'Summarize the conversation.',
      attachments: [],
      createdAt: run.startedAt,
      order: 1,
      summarize: true,
      deliveries: [{ roleId: role.id, status: 'running', runId: run.id, error: '' }],
    };
    service.board.record('chat_request', request, 'user', 'Summary fixture');
    return updateRun({ requestId: request.id });
  };
  return {
    ...fixture,
    service,
    role,
    input,
    skill,
    other,
    run,
    updateRun,
    isolated,
    summary,
    read: (skillId = skill.id) => service.agentCall(run.id, 'read_skill', { input: { skillId } }),
    access: () => service.agentCall(run.id, 'execution_access', {}),
  };
};

export const cleanupSkillReaders = async () => {
  for (const { daemon } of resources)
    for (const id of daemon.service.controllers.keys())
      if (id.startsWith('skill-reader-')) daemon.service.controllers.delete(id);
  await cleanup();
};
