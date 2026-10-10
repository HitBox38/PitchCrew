import { expect, it, vi, beforeEach } from 'vitest';
import type { ChatContext } from '@pitchcrew/core';
import { codex } from '../src/codex/index.ts';
import { claudeCode } from '../src/claude-code/index.ts';
import { chatCli } from '../src/process.ts';

vi.mock('../src/process.ts', () => ({
  chatCli: vi.fn(async (_command, _args, context, extract) => {
    extract({ type: 'thread.started', thread_id: '11111111-1111-4111-8111-111111111111' });
    return { reply: 'Fixture reply.' };
  }),
  detectCli: vi.fn(),
  promptFor: vi.fn(),
  runCli: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
const context: ChatContext = {
  card: null,
  role: {
    id: 'scout',
    name: 'Scout',
    description: 'Fixture',
    runtime: 'codex',
    model: 'fixture-model',
    reasoning: 'high',
    enabled: true,
    instructions: 'Fixture',
  },
  profile: [],
  messages: [],
  request: 'Next request.',
  directory: '/fixture/run',
  session: { directory: '/fixture/session' },
  mcp: {
    command: 'node',
    args: ['mcp'],
    env: { PITCHCREW_RUN_TOKEN: 'fresh-token', PITCHCREW_DAEMON_URL: 'http://127.0.0.1:1' },
  },
  signal: new AbortController().signal,
  onMessage: () => {},
};
it('starts and resumes Codex sessions while retaining fresh scoped tools and sandbox restrictions', async () => {
  const onSession = vi.fn();
  await codex.chat({ ...context, onSession });
  expect(onSession).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  const first = vi.mocked(chatCli).mock.calls[0];
  expect(first[1]).not.toContain('--ephemeral');
  expect(first[1]).not.toContain('resume');
  await codex.chat({
    ...context,
    session: { ...context.session!, id: '11111111-1111-4111-8111-111111111111' },
    mcp: { ...context.mcp, env: { ...context.mcp.env, PITCHCREW_RUN_TOKEN: 'next-token' } },
  });
  const resumed = vi.mocked(chatCli).mock.calls[1];
  expect(resumed[1].slice(-3)).toEqual(['resume', '11111111-1111-4111-8111-111111111111', '-']);
  expect(resumed[1]).toEqual(
    expect.arrayContaining([
      '--ignore-user-config',
      '--ignore-rules',
      '--sandbox',
      'read-only',
      'shell_tool',
      'unified_exec',
      'features.apps=false',
      'features.hooks=false',
    ]),
  );
  expect(resumed[2].mcp.env.PITCHCREW_RUN_TOKEN).toBe('next-token');
});
it('assigns Claude session identity and refreshes strict MCP configuration on resume', async () => {
  const onSession = vi.fn();
  await claudeCode.chat({ ...context, onSession });
  const first = vi.mocked(chatCli).mock.calls[0][1];
  const id = first[first.indexOf('--session-id') + 1];
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  expect(onSession).toHaveBeenCalledWith(id);
  expect(first).not.toContain('--no-session-persistence');
  await claudeCode.chat({
    ...context,
    session: { directory: '/fixture/session', id },
    mcp: { ...context.mcp, env: { ...context.mcp.env, PITCHCREW_RUN_TOKEN: 'next-token' } },
  });
  const flags = vi.mocked(chatCli).mock.calls[1][1];
  expect(flags[flags.indexOf('--resume') + 1]).toBe(id);
  expect(flags).toEqual(
    expect.arrayContaining([
      '--restricted',
      '--tools',
      '',
      '--strict-mcp-config',
      '--permission-mode',
      'dontAsk',
    ]),
  );
  expect(
    JSON.parse(flags[flags.indexOf('--mcp-config') + 1]).mcpServers.pitchcrew.env
      .PITCHCREW_RUN_TOKEN,
  ).toBe('next-token');
});
it('retains ephemeral isolation for ordinary turns without a conversation session', async () => {
  await codex.chat({ ...context, session: undefined });
  await claudeCode.chat({ ...context, session: undefined });
  expect(vi.mocked(chatCli).mock.calls[0][1]).toContain('--ephemeral');
  expect(vi.mocked(chatCli).mock.calls[1][1]).toContain('--no-session-persistence');
});
