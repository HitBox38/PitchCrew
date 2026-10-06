import type { ChatContext, RunContext, RuntimeId } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { adapters } from '../src/index.ts';
import { chatCli, runCli, runCliText } from '../src/process.ts';
import { contextFor, cleanup } from './helpers/runtime.ts';

vi.mock('../src/process.ts', async () => {
  const actual = await vi.importActual<typeof import('../src/process.ts')>('../src/process.ts');
  return {
    ...actual,
    runCli: vi.fn(async () => ({ role: 'scout', fit: 87, reasons: ['Fixture'] })),
    chatCli: vi.fn(async () => ({ reply: 'Fixture' })),
    runCliText: vi.fn(async (_command, _args, context: RunContext | ChatContext) =>
      JSON.stringify(
        'messages' in context
          ? { reply: 'Fixture' }
          : { role: 'scout', fit: 87, reasons: ['Fixture'] },
      ),
    ),
  };
});
afterEach(async () => {
  vi.clearAllMocks();
  await cleanup();
});

it.each([
  ['codex', '-c', 'model_reasoning_effort="high"'],
  ['claude-code', '--effort', 'high'],
  ['copilot-cli', '--reasoning-effort', 'high'],
  ['opencode', '--variant', 'high'],
  ['pi', '--thinking', 'high'],
  ['oh-my-pi', '--thinking', 'high'],
] as const)(
  '%s forwards reasoning for workflows and chats and leaves CLI default unset',
  async (runtime, flag, value) => {
    const base = await contextFor('pi');
    const context = {
      ...base,
      role: {
        ...base.role,
        runtime: runtime as RuntimeId,
        model: 'fixture',
        reasoning: 'high' as const,
      },
    };
    const calls = () => [
      ...vi.mocked(runCli).mock.calls,
      ...vi.mocked(chatCli).mock.calls,
      ...vi.mocked(runCliText).mock.calls,
    ];
    await adapters[runtime].run(context);
    await adapters[runtime].chat({ ...context, card: null, messages: [] });
    for (const [, args] of calls()) {
      expect(args.some((arg, index) => arg === flag && args[index + 1] === value)).toBe(true);
      expect(args).toContain('fixture');
    }
    vi.clearAllMocks();
    await adapters[runtime].chat({
      ...context,
      role: { ...context.role, reasoning: null },
      card: null,
      messages: [],
    });
    expect(calls()).toHaveLength(1);
    const args = calls()[0][1];
    expect(args).not.toContain(value);
    if (runtime !== 'codex') expect(args).not.toContain(flag);
  },
);
