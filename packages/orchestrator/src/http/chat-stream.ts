import express from 'express';
import { CrewService } from '../service.ts';

export function registerChatStream(
  app: express.Express,
  service: CrewService,
  chatStreams: Set<express.Response>,
) {
  app.get('/api/chat/stream', (_req, res) => {
    chatStreams.add(res);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.flushHeaders();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let blocked = false;
    let messagesChanged = true;
    const send = () => {
      timer = undefined;
      if (blocked || res.destroyed) return;
      blocked = !res.write(`data: ${JSON.stringify(service.chatUpdate(messagesChanged))}\n\n`);
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
