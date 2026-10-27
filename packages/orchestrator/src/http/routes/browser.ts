import {
  desktopBrowserHostSchema,
  nativeBrowserCommandSchema,
} from '../../../../core/src/native-browser.ts';
import {
  browserInputSchema,
  browserViewportSchema,
  roleIdSchema,
  type Conversation,
  type Role,
} from '@pitchcrew/core';
import { assertPublicUrl } from '@pitchcrew/mcp/computer';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CrewService } from '../../service.ts';
import { streamBrowserFrames } from '../browser-stream.ts';

type Route = { Params: { id: string }; Querystring: { threadId: string } };
export const registerBrowserRoutes = (app: FastifyInstance, service: CrewService) => {
  const authorize = (threadId: string, roleId?: string) => {
    const thread = service.board.get<Conversation>(
      'conversation',
      z.string().min(1).max(80).parse(threadId),
    );
    if (thread.kind === 'agent_dm' || thread.kind === 'history')
      throw new Error('This conversation is read-only.');
    if (roleId) {
      roleIdSchema.parse(roleId);
      const role = service.board.get<Role>('role', roleId);
      if (
        !thread.participants.includes(roleId) ||
        role.retiredAt ||
        role.capabilities?.computerUse !== true
      )
        throw new Error('This agent cannot use a browser in this conversation.');
    }
    return thread;
  };
  app.post('/api/browser-host', (req) => {
    service.computer.desktopHosts.register(desktopBrowserHostSchema.parse(req.body));
    return { ok: true };
  });
  app.get<{ Querystring: { threadId: string } }>('/api/browser', (req, res) => {
    const thread = authorize(req.query.threadId);
    res
      .header('Cache-Control', 'no-store')
      .send(
        service.computer.browsers
          .list()
          .filter(
            (item) =>
              (thread.cardId ? item.cardId === thread.cardId : item.threadId === thread.id) &&
              thread.participants.includes(item.roleId) &&
              service.board.get<Role>('role', item.roleId).capabilities?.computerUse === true &&
              !service.board.get<Role>('role', item.roleId).retiredAt,
          ),
      );
  });
  app.get<Route>('/api/browser/:id/native', async (req) => {
    const thread = authorize(req.query.threadId, req.params.id);
    const key = service.computer.browsers.key(req.params.id, thread.id, thread.cardId);
    if (!service.computer.browsers.forRole(key).info.native)
      throw new Error('This session uses streamed viewing.');
    const driver = await service.computer.browsers.driver(key);
    if (!driver.nativeState) throw new Error('This session uses streamed viewing.');
    return driver.nativeState();
  });
  app.post<Route>('/api/browser/:id/native', async (req) => {
    const thread = authorize(req.query.threadId, req.params.id);
    const key = service.computer.browsers.key(req.params.id, thread.id, thread.cardId);
    const { leaseId, command } = z
      .object({ leaseId: z.uuid(), command: nativeBrowserCommandSchema })
      .strict()
      .parse(req.body);
    await service.computer.syncNativeControl(key, leaseId);
    const driver = await service.computer.browsers.driver(key);
    if (!driver.nativeCommand) throw new Error('This session uses streamed viewing.');
    return driver.nativeCommand(command);
  });
  app.get<Route>('/api/browser/:id/stream', async (req, res) => {
    const { id } = req.params;
    const thread = authorize(req.query.threadId, id);
    const sessionKey = service.computer.browsers.key(id, thread.id, thread.cardId);
    await streamBrowserFrames(
      res,
      (signal) => service.computer.browsers.watchFrames(sessionKey, signal),
      () => {
        const current = authorize(req.query.threadId, id);
        if (service.computer.browsers.key(id, current.id, current.cardId) !== sessionKey)
          throw new Error('The browser conversation changed.');
      },
    );
  });
  app.post<Route>('/api/browser/:id/open', async (req) => {
    const thread = authorize(req.query.threadId, req.params.id);
    await service.computer.openBrowser(req.params.id, thread.id, thread.cardId);
    const driver = await service.computer.browsers.driver(
      service.computer.browsers.key(req.params.id, thread.id, thread.cardId),
    );
    return { ok: true, native: !!driver.native };
  });
  app.post<Route>('/api/browser/:id/control', async (req) => {
    const thread = authorize(req.query.threadId, req.params.id);
    const sessionKey = service.computer.browsers.key(req.params.id, thread.id, thread.cardId);
    const input = z
      .object({ operation: z.enum(['take', 'release', 'renew']), leaseId: z.uuid().optional() })
      .strict()
      .parse(req.body);
    if (input.operation === 'take') {
      const leaseId = service.computer.takeControl(sessionKey);
      try {
        await service.computer.syncNativeControl(sessionKey, leaseId);
      } catch (error) {
        await service.computer.returnControl(sessionKey, leaseId);
        throw error;
      }
      return { leaseId };
    }
    const leaseId = z.uuid().parse(input.leaseId);
    if (input.operation === 'release') await service.computer.returnControl(sessionKey, leaseId);
    else {
      service.computer.browsers.renew(sessionKey, leaseId);
      await service.computer.syncNativeControl(sessionKey, leaseId);
    }
    return { ok: true };
  });
  app.post<Route>('/api/browser/:id/viewport', async (req) => {
    const thread = authorize(req.query.threadId, req.params.id);
    const sessionKey = service.computer.browsers.key(req.params.id, thread.id, thread.cardId);
    const { width, height, leaseId } = browserViewportSchema
      .extend({ leaseId: z.uuid().optional() })
      .strict()
      .parse(req.body);
    return {
      applied: await service.computer.resizeBrowser(sessionKey, { width, height }, leaseId),
    };
  });
  app.post<Route>('/api/browser/:id/input', async (req) => {
    const thread = authorize(req.query.threadId, req.params.id);
    const sessionKey = service.computer.browsers.key(req.params.id, thread.id, thread.cardId);
    const { leaseId, input } = z
      .object({ leaseId: z.uuid(), input: browserInputSchema })
      .strict()
      .parse(req.body);
    await service.computer.manualInput(sessionKey, leaseId, input);
    return { ok: true };
  });
  app.post<Route>('/api/browser/:id/sites', async (req) => {
    const thread = authorize(req.query.threadId, req.params.id);
    const sessionKey = service.computer.browsers.key(req.params.id, thread.id, thread.cardId);
    const { taskId, url, allowed, approvalId } = z
      .object({
        taskId: z.string().min(1).max(100),
        url: z.url().max(2000),
        allowed: z.boolean().default(true),
        approvalId: z.uuid().optional(),
      })
      .strict()
      .parse(req.body);
    await assertPublicUrl(url);
    authorize(req.query.threadId, req.params.id);
    service.computer.allowSite(sessionKey, taskId, new URL(url).origin, allowed, approvalId);
    return { ok: true };
  });
  app.post<Route>('/api/browser/:id/close', async (req) => {
    const thread = authorize(req.query.threadId, req.params.id);
    const sessionKey = service.computer.browsers.key(req.params.id, thread.id, thread.cardId);
    const { reset } = z
      .object({ reset: z.boolean().default(false) })
      .strict()
      .parse(req.body ?? {});
    const session = service.computer.browsers
      .list()
      .find(
        (item) =>
          service.computer.browsers.key(item.roleId, item.threadId, item.cardId) === sessionKey,
      );
    if (session?.runId) {
      if (service.controllers.has(session.runId)) service.cancelRun(session.runId);
      await service.computer.stop(session.runId);
    }
    await service.computer.browsers.closeRole(sessionKey, reset);
    return { ok: true };
  });
};
