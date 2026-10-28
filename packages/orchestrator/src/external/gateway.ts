import { changeJobState, conversationHistory, deleteJob, updateJobDetails } from '@pitchcrew/board';
import type { Card, Conversation, Role, Run } from '@pitchcrew/core';
import { externalTools } from '@pitchcrew/mcp/external/tools';
import { readProfile } from '@pitchcrew/packet';
import { z } from 'zod';
import type { CrewContext } from '../crew/types.ts';
import { createConversation } from '../crew/conversations.ts';
import { sendConversation } from '../crew/conversation-queue.ts';
import { workspaceQueue } from '../crew/queue/projection.ts';
import { createExternalJob } from './jobs.ts';

const actor = 'external-mcp';
const page = <T>(items: T[], offset: number, limit: number) => ({
  items: items.slice(offset, offset + limit),
  total: items.length,
  nextOffset: offset + limit < items.length ? offset + limit : null,
});
const visibleRun = (context: CrewContext, run: Run) => ({
  id: run.id,
  cardId: run.cardId,
  threadId: run.threadId,
  roleId: run.roleId,
  status: run.status,
  mode: run.mode,
  message: run.message,
  startedAt: run.startedAt,
  finishedAt: run.finishedAt,
  activity: context.runActivities.get(run.id)?.entries ?? run.activity,
  activityTruncated: context.runActivities.get(run.id)?.truncated ?? run.activityTruncated,
});
const idleCard = (context: CrewContext, id: string) => {
  const card = context.board.get<Card>('card', id);
  if (
    card.owner ||
    context.board
      .list<Run>('run')
      .some((run) => run.cardId === id && ['running', 'waiting'].includes(run.status))
  )
    throw new Error('Finish or cancel active job work before changing this job.');
  return card;
};

/** External callers have an explicit allowlist, never the user API or an internal run capability. */
export const externalCall = async (
  context: CrewContext,
  action: string,
  data: unknown,
): Promise<Record<string, unknown>> => {
  switch (action) {
    case 'status': {
      externalTools.status.schema.parse(data);
      const cards = context.board.list<Card>('card');
      return {
        jobs: cards.length,
        states: Object.fromEntries(
          [...new Set(cards.map((card) => card.state))].map((state) => [
            state,
            cards.filter((card) => card.state === state).length,
          ]),
        ),
        agents: context.board
          .list<Role>('role')
          .map(({ id, name, enabled, retiredAt, workflow, runtime }) => ({
            id,
            name,
            enabled,
            retired: !!retiredAt,
            workflow,
            runtime,
            available:
              enabled &&
              !retiredAt &&
              context.runtimes.some((item) => item.id === runtime && item.available),
          })),
      };
    }
    case 'list_jobs': {
      const input = externalTools.list_jobs.schema.parse(data);
      const query = input.query?.toLowerCase() ?? '';
      const cards = context.board
        .list<Card>('card')
        .filter(
          (card) =>
            (!input.state || card.state === input.state) &&
            `${card.company} ${card.title} ${card.location}`.toLowerCase().includes(query),
        );
      return page(
        cards.map(({ id, company, title, state, location, url, updatedAt }) => ({
          id,
          company,
          title,
          state,
          location,
          url,
          updatedAt,
        })),
        input.offset,
        input.limit,
      );
    }
    case 'read_job': {
      const { cardId } = externalTools.read_job.schema.parse(data);
      const { sourceHtml: _sourceHtml, ...card } = context.board.get<Card>('card', cardId);
      return { card };
    }
    case 'read_profile':
      externalTools.read_profile.schema.parse(data);
      return { files: await readProfile(context.directory) };
    case 'list_conversations': {
      const input = externalTools.list_conversations.schema.parse(data);
      return page(
        context.board
          .list<Conversation>('conversation')
          .filter((item) => item.archived === input.archived)
          .map(({ id, title, kind, participants, cardId, updatedAt }) => ({
            id,
            title,
            kind,
            participants,
            cardId,
            updatedAt,
          })),
        input.offset,
        input.limit,
      );
    }
    case 'read_conversation': {
      const input = externalTools.read_conversation.schema.parse(data);
      context.board.get<Conversation>('conversation', input.conversationId);
      const history = conversationHistory(context.board, input.conversationId, input.anchor);
      return {
        ...history,
        items: history.items.map((item) =>
          item.kind === 'turn' ? { ...item, run: visibleRun(context, item.run) } : item,
        ),
      };
    }
    case 'read_run': {
      const { runId } = externalTools.read_run.schema.parse(data);
      return { run: visibleRun(context, context.board.get<Run>('run', runId)) };
    }
    case 'read_queue': {
      externalTools.read_queue.schema.parse(data);
      const queue = workspaceQueue(context);
      return {
        queue: {
          ...queue,
          queues: queue.queues.map((item) => ({
            ...item,
            runs: item.runs.map((run) => visibleRun(context, run)),
          })),
        },
      };
    }
    case 'create_job':
      return createExternalJob(context, data);
    case 'update_job': {
      const input = externalTools.update_job.schema.parse(data);
      idleCard(context, input.cardId);
      return {
        card: updateJobDetails(context.board, input.cardId, input.changes, actor, '', input.reason),
      };
    }
    case 'move_job': {
      const input = externalTools.move_job.schema.parse(data);
      idleCard(context, input.cardId);
      return {
        card: changeJobState(context.board, input.cardId, input.state, actor, input.reason),
      };
    }
    case 'delete_job': {
      const input = externalTools.delete_job.schema.parse(data);
      idleCard(context, input.cardId);
      deleteJob(context.board, input.cardId, actor, input.reason);
      return { ok: true, cardId: input.cardId };
    }
    case 'create_conversation': {
      const input = externalTools.create_conversation.schema.parse(data);
      return {
        conversation: createConversation(
          context,
          { ...input, leadId: input.leadId ?? input.participants[0] },
          actor,
        ),
      };
    }
    case 'send_message': {
      const { conversationId, content } = externalTools.send_message.schema.parse(data);
      return {
        request: await sendConversation(context, conversationId, {
          content: `[External MCP agent]\n${content}`,
          intent: 'queue',
        }),
      };
    }
    default:
      throw new Error('Unknown external MCP action. Use the advertised external tools.');
  }
};

export const externalRequest = z
  .object({
    action: z.enum(
      Object.keys(externalTools) as [keyof typeof externalTools, ...(keyof typeof externalTools)[]],
    ),
    input: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
