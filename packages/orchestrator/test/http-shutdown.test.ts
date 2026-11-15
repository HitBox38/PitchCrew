import { once } from 'node:events';
import { connect, type Socket } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);

it('closes incomplete HTTP requests when listening through the public Node server', async () => {
  const { daemon, port } = await setup(false, { dev: false });
  const accepted = once(daemon.http, 'connection');
  const client = connect(port, '127.0.0.1');
  const [socket] = (await accepted) as [Socket];
  const received = once(socket, 'data');
  client.write(`GET /api/health HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\n`);
  await received;
  const closing = daemon.close();
  try {
    await vi.waitFor(() => expect(socket.destroyed).toBe(true), { timeout: 1000 });
    await closing;
    expect(daemon.http.listening).toBe(false);
  } finally {
    client.destroy();
    await closing;
  }
});
