import { createWorkspaceActivity } from './workspace-activity.ts';
import { workspaceMessages } from '@pitchcrew/board';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { ServerResponse } from 'node:http';
import type { CrewService } from '../service.ts';

export function registerChatStream(
  app: FastifyInstance,
  service: CrewService,
  chatStreams: Set<ServerResponse>,
) {
  app.get('/api/chat/stream', (req, reply) => {
    const workspace =
      z.object({ view: z.literal('workspace').optional() }).parse(req.query).view === 'workspace';
    // Keep ownership of the response until disconnect, including Node backpressure.
    reply.hijack();
    const res = reply.raw;
    chatStreams.add(res);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.flushHeaders();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let blocked = false;
    let messagesChanged = true;
    let previousActivity = '';
    const workspaceActivity = createWorkspaceActivity(service);
    const send = () => {
      timer = undefined;
      if (blocked || res.destroyed) return;
      const update =
        workspace && messagesChanged
          ? {
              ...service.chatUpdate(false),
              ...workspaceMessages(service.board),
              userInputs:
                service.board.list<import('@pitchcrew/core').UserInputRequest>('user_input'),
            }
          : service.chatUpdate(messagesChanged && !workspace);
      if (workspace) update.activityRuns = workspaceActivity(update.activityRuns ?? []);
      const activity = JSON.stringify(update.activityRuns);
      if (!messagesChanged && activity === previousActivity) delete update.activityRuns;
      previousActivity = activity ?? '';
      blocked = !res.write(`data: ${JSON.stringify(update)}\n\n`);
      messagesChanged = false;
    };
    // Coalesce fast token bursts, and retain only the latest state for slow clients.
    const schedule = () => {
      if (!timer && !blocked && !res.destroyed) timer = setTimeout(send, 40);
    };
    const unsubscribe = service.subscribeChat((changed) => {
      messagesChanged ||= changed;
      schedule();
    });
    res.on('drain', () => {
      blocked = false;
      schedule();
    });
    const heartbeat = setInterval(() => {
      if (!blocked && !res.destroyed) blocked = !res.write(': heartbeat\n\n');
    }, 15000);
    res.on('close', () => {
      chatStreams.delete(res);
      unsubscribe();
      clearTimeout(timer);
      clearInterval(heartbeat);
    });
    send();
  });
}
