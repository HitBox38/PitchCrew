import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { runAcpText } from '../src/acp.ts';
import { runCliText } from '../src/process.ts';
import { cleanup, contextFor, requestFor } from './helpers/runtime.ts';

afterEach(async () => {
  vi.useRealTimers();
  await cleanup();
});

it.each(['cli', 'acp'] as const)(
  '%s gives Writer workflows and chats more than three minutes while bounding stuck runs',
  async (transport) => {
    for (const chat of [false, true]) {
      const context = await contextFor('kiro-cli', 'wait');
      context.role = {
        ...context.role,
        id: 'writer',
        runtime: 'claude-code',
        model: 'sonnet',
        reasoning: 'high',
      };
      const active = chat ? { ...context, card: null, messages: [], onReply: vi.fn() } : context;
      const fixture = fileURLToPath(
        new URL(`./fixtures/${transport === 'cli' ? 'runtime' : 'acp'}-cli.mjs`, import.meta.url),
      );
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const result =
        transport === 'cli'
          ? runCliText(process.execPath, [fixture, 'claude'], active, 'Fixture prompt', () => null)
          : runAcpText(process.execPath, [fixture], active, 'Fixture prompt');
      let settled = false;
      void result.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      const rejected = expect(result).rejects.toThrow(
        'Pitchcrew stopped the runtime after its 30-minute limit.',
      );
      await vi.waitFor(async () => expect((await requestFor(context)).runtime).toBeDefined());
      await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(27 * 60 * 1000);
      await rejected;
      vi.useRealTimers();
    }
  },
);
