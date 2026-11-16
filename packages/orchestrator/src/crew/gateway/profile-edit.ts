import type { ChatMessage, ChatRequest, Role, Run } from '@pitchcrew/core';
import { readProfile } from '@pitchcrew/packet';
import { z } from 'zod';
import { checkBaseline, trashProfileNote, writeProfileNote } from '../../profile-notes/index.ts';
import { contentDigest, noteNameSchema } from '../../profile-notes/helpers.ts';
import { changeProfile } from '../../profile-sources/mutation.ts';
import type { CrewContext, RunCapability } from '../types.ts';
import { questionTaskOrigin } from '../user-input/context.ts';
import { profileEditTarget, syncProfileEdit } from './profile-sync.ts';

/** Direct user turns may edit; scheduled checks and agent handoffs still propose changes. */
export const authorizeProfileEdit = (
  context: CrewContext,
  capability: RunCapability,
  token: string,
) => {
  const run = context.board.get<Run>('run', capability.runId);
  const role = context.board.get<Role>('role', capability.roleId);
  const signal = context.controllers.get(run.id)?.signal;
  if (
    context.closing ||
    context.capabilities.get(token) !== capability ||
    !signal ||
    signal.aborted ||
    run.status !== 'running' ||
    run.roleId !== role.id ||
    !role.enabled ||
    role.capabilities?.editProfile !== true ||
    run.mode !== 'chat' ||
    run.purpose ||
    run.taskId ||
    run.routineId ||
    run.deepReviewId
  )
    throw new Error('Profile edits require editProfile and an active direct user chat request.');
  const request = run.requestId
    ? context.board.get<ChatRequest>('chat_request', run.requestId)
    : undefined;
  const origin = questionTaskOrigin(context, run);
  if (
    origin.taskId ||
    origin.routineId ||
    origin.mode !== 'chat' ||
    origin.purpose ||
    origin.deepReviewId ||
    origin.roleId !== role.id
  )
    throw new Error(
      'Only a direct user request authorizes profile edits; other turns must propose updates.',
    );
  const requests = [
    request,
    origin.requestId ? context.board.get<ChatRequest>('chat_request', origin.requestId) : undefined,
  ];
  const legacyMessage = !origin.requestId
    ? context.board
        .list<ChatMessage>('message')
        .find(
          (message) =>
            message.runId === origin.id &&
            message.from === 'user' &&
            message.to === role.id &&
            message.threadId === origin.threadId &&
            !message.content.startsWith('[External MCP agent]\n'),
        )
    : undefined;
  if (
    (!origin.requestId && !legacyMessage) ||
    requests.some((item) => {
      if (!item) return false;
      const message = context.board.get<ChatMessage>('message', item.messageId);
      return (
        item.threadId !== run.threadId ||
        item.routine ||
        item.summarize ||
        item.boardAction ||
        item.deepReviewRequest ||
        item.roundId ||
        item.mode === 'workflow' ||
        message.from !== 'user' ||
        message.threadId !== run.threadId ||
        message.content.startsWith('[External MCP agent]\n')
      );
    }) ||
    (request &&
      !request.deliveries.some(
        (delivery) =>
          delivery.roleId === role.id && delivery.runId === run.id && delivery.status === 'running',
      ))
  )
    throw new Error(
      'Only a direct user request authorizes profile edits; other turns must propose updates.',
    );
  return { role, signal };
};

const editInput = z
  .object({
    action: z.enum(['save', 'delete']),
    name: noteNameSchema,
    baseline: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    content: z
      .string()
      .max(50000)
      .refine((value) => !value.includes('\0'))
      .optional(),
    sourceId: z
      .string()
      .regex(/^[a-f0-9]{24}$/)
      .optional(),
    path: z.string().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((input, issue) => {
    if ((input.action === 'save') !== (input.content !== undefined))
      issue.addIssue({ code: 'custom', message: 'Supply content only when saving a note.' });
    if (input.action === 'delete' && input.baseline === null)
      issue.addIssue({ code: 'custom', message: 'Deletion requires the current note baseline.' });
  });

export const profileEditAction = async (
  context: CrewContext,
  capability: RunCapability,
  token: string,
  action: string,
  data: unknown,
): Promise<Record<string, unknown>> => {
  const authorize = () => authorizeProfileEdit(context, capability, token);
  authorize();
  if (action === 'profile_edit_sources') {
    const [profile, sources] = await Promise.all([
      readProfile(context.directory),
      context.profileSources.list(),
    ]);
    authorize();
    return {
      notes: profile.map(({ name, content }) => ({ name, baseline: contentDigest(content) })),
      sources: sources
        .filter((source) => !source.mode)
        .map(({ id, label, input, files }) => ({
          id,
          label,
          input,
          files: files.map(({ name, path, revision }) => ({ name, path, revision })),
        })),
    };
  }
  const input = editInput.parse(data);
  return changeProfile(
    context,
    async () => {
      authorize();
      const sources = await context.profileSources.list();
      const target = profileEditTarget(sources, input);
      await checkBaseline(context, input.name, input.baseline);
      authorize();
      let trashId: string | undefined;
      if (input.action === 'save')
        await writeProfileNote(context, input.name, input.content!, input.baseline);
      else trashId = (await trashProfileNote(context, input.name)).trashId;
      const sync = target
        ? await syncProfileEdit(context, target, input, authorize)
        : { status: 'local_only' };
      return { ok: true, name: input.name, trashId, sync };
    },
    { activeRunId: capability.runId },
  );
};
