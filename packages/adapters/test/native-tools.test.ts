import {
  crewToolLabelsFor,
  toolFailureDescriptions,
  unknownCrewToolLabels,
  type ChatContext,
  type RunContext,
  type RuntimeActivity,
} from '@pitchcrew/core';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { activityStream, showsActivity } from '../src/activity/index.ts';
import {
  commandLine,
  contentText,
  displayPath,
  displayUrl,
  environmentSecrets,
  exitReason,
  nativeToolTracker,
  planProgress,
  type NativeToolEvent,
} from '../src/activity/native-tools.ts';

const track = (secrets: string[] = []) => {
  const rows: RuntimeActivity[] = [];
  const tool = nativeToolTracker((entry) => rows.push(entry), secrets);
  const send = (...events: NativeToolEvent[]) => events.forEach(tool);
  return { rows, send };
};

describe('native tool tracker', () => {
  it('shows a native call from start to its outcome under one id', () => {
    const { rows, send } = track();
    send(
      { phase: 'start', callId: 'a', kind: 'command', detail: 'ls fixture' },
      { phase: 'finish', callId: 'a', failed: false, detail: 'ignored for a started call' },
      { phase: 'start', callId: 'b', kind: 'read', detail: 'notes.md' },
      { phase: 'finish', callId: 'b', failed: true, reason: 'ENOENT: no such file' },
      { phase: 'start', callId: 'c', kind: 'fetch' },
      { phase: 'finish', callId: 'c', failed: true, interrupted: true },
    );
    expect(rows).toEqual([
      {
        id: 'native-a',
        kind: 'tool',
        tool: 'command',
        label: 'Running command',
        detail: 'ls fixture',
        status: 'running',
      },
      {
        id: 'native-a',
        kind: 'tool',
        tool: 'command',
        label: 'Ran command',
        detail: 'ls fixture',
        status: 'completed',
      },
      expect.objectContaining({ id: 'native-b', status: 'running', label: 'Reading file' }),
      {
        id: 'native-b',
        kind: 'tool',
        tool: 'read',
        label: "Couldn't read file",
        detail: 'notes.md',
        status: 'failed',
        error: 'ENOENT: no such file',
        failure: { reason: 'not_found' },
      },
      expect.objectContaining({ id: 'native-c', status: 'running' }),
      {
        id: 'native-c',
        kind: 'tool',
        tool: 'fetch',
        label: 'Fetching page',
        status: 'interrupted',
      },
    ]);
  });

  it('prefers a stated reason, and falls back to its description when there is no text', () => {
    const { rows, send } = track();
    send(
      { phase: 'start', callId: 'a', kind: 'command' },
      {
        phase: 'finish',
        callId: 'a',
        failed: true,
        reason: 'Exit code 1: denied',
        failure: 'tool_error',
      },
      { phase: 'start', callId: 'b', kind: 'edit' },
      { phase: 'finish', callId: 'b', failed: true, failure: 'not_allowed' },
      { phase: 'start', callId: 'c', kind: 'edit' },
      { phase: 'finish', callId: 'c', failed: true, reason: ' \n ' },
    );
    expect(rows.filter((row) => row.status === 'failed')).toEqual([
      expect.objectContaining({ error: 'Exit code 1: denied', failure: { reason: 'tool_error' } }),
      expect.objectContaining({
        error: 'This run is not allowed to use that tool or action.',
        failure: { reason: 'not_allowed' },
      }),
      expect.objectContaining({
        error: 'The tool ran and reported a failure.',
        failure: { reason: 'tool_error' },
      }),
    ]);
  });

  it('leaves Pitchcrew calls to the gateway unless they failed before reaching it', () => {
    const { rows, send } = track();
    send(
      { phase: 'start', callId: 'ok', kind: 'mcp', pitchcrew: 'pitchcrew_get_card', detail: 'x' },
      { phase: 'finish', callId: 'ok', failed: false },
      { phase: 'start', callId: 'refused', kind: 'mcp', pitchcrew: 'pitchcrew_export_packet' },
      { phase: 'finish', callId: 'refused', failed: true, reason: 'This role cannot export.' },
      { phase: 'start', callId: 'stopped', kind: 'mcp', pitchcrew: 'pitchcrew_get_card' },
      { phase: 'finish', callId: 'stopped', failed: true, interrupted: true, preGateway: true },
    );
    expect(rows).toEqual([]);
    send(
      { phase: 'start', callId: 'invalid', kind: 'mcp', pitchcrew: 'pitchcrew_get_card' },
      {
        phase: 'finish',
        callId: 'invalid',
        failed: true,
        reason: 'MCP error -32602: Input validation error: expected string at cardId',
      },
      { phase: 'start', callId: 'timeout', kind: 'mcp', pitchcrew: 'gmail_search_messages' },
      { phase: 'finish', callId: 'timeout', failed: true, reason: 'timed out', preGateway: true },
      { phase: 'finish', callId: 'gone', failed: true, preGateway: true, pitchcrew: 'pitchcrew_x' },
    );
    expect(rows).toEqual([
      {
        id: 'native-invalid',
        kind: 'tool',
        tool: crewToolLabelsFor('card').tool,
        label: crewToolLabelsFor('card').failed,
        status: 'failed',
        error: 'MCP error -32602: Input validation error: expected string at cardId',
        failure: { reason: 'invalid_input', tool: 'pitchcrew_get_card' },
      },
      {
        id: 'native-timeout',
        kind: 'tool',
        tool: crewToolLabelsFor('connector').tool,
        label: crewToolLabelsFor('connector').failed,
        status: 'failed',
        error: 'timed out',
        failure: { reason: 'timeout', tool: 'gmail_search_messages' },
      },
      // An unpublished name gets the generic words and the MCP kind, since it still went to
      // Pitchcrew's server; the name never reaches diagnostics. It never ran, so an unrecognized
      // failure is unclassified rather than the tool's own error.
      {
        id: 'native-gone',
        kind: 'tool',
        tool: 'mcp',
        label: unknownCrewToolLabels.failed,
        status: 'failed',
        error: toolFailureDescriptions.unclassified,
        failure: { reason: 'unclassified' },
      },
    ]);
  });

  it('never names the keys a model sent when a Pitchcrew call fails validation', () => {
    const { rows, send } = track();
    send(
      { phase: 'start', callId: 'skill', kind: 'mcp', pitchcrew: 'pitchcrew_read_skill' },
      {
        phase: 'finish',
        callId: 'skill',
        failed: true,
        // MCP SDK 1.32 lists one issue per line, naming unrecognized keys.
        reason:
          'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_read_skill: Invalid UUID at skillId\nUnrecognized key: "PRIVATE KEY NAME"\nUnrecognized keys: "PRIVATE_A", "PRIVATE_B"',
      },
      { phase: 'start', callId: 'odd', kind: 'mcp', pitchcrew: 'pitchcrew_get_card' },
      { phase: 'finish', callId: 'odd', failed: true, reason: 'MCP error -32603: Internal error' },
    );
    expect(JSON.stringify(rows)).not.toContain('PRIVATE');
    expect(rows.map(({ error, failure }) => ({ error, failure }))).toEqual([
      {
        error:
          'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_read_skill: Invalid UUID at skillId Unexpected field Unexpected field',
        failure: { reason: 'invalid_input', tool: 'pitchcrew_read_skill' },
      },
      // The MCP server's own internal error: a fault the agent did not cause.
      {
        error: 'MCP error -32603: Internal error',
        failure: { reason: 'unclassified', tool: 'pitchcrew_get_card' },
      },
    ]);
  });

  it("shows only its reason's sentence for a browser call, never the runtime's text", () => {
    const { rows, send } = track();
    send(
      { phase: 'start', callId: 'fill', kind: 'mcp', pitchcrew: 'pitchcrew_computer_execute' },
      {
        phase: 'finish',
        callId: 'fill',
        failed: true,
        reason:
          'MCP error -32602: Input validation error: selector ref:e14 got value "PRIVATE_TYPED"',
      },
      {
        phase: 'finish',
        callId: 'tabs',
        failed: true,
        preGateway: true,
        reason: 'Request timed out on https://jobs.example.com/apply?ref=PRIVATE_URL',
        pitchcrew: 'pitchcrew_computer_tabs',
      },
    );
    const browser = crewToolLabelsFor('computer_execute');
    expect(rows).toEqual([
      {
        id: 'native-fill',
        kind: 'tool',
        tool: 'browser',
        label: browser.failed,
        status: 'failed',
        error: toolFailureDescriptions.invalid_input,
        failure: { reason: 'invalid_input', tool: 'pitchcrew_computer_execute' },
      },
      {
        id: 'native-tabs',
        kind: 'tool',
        tool: 'browser',
        label: browser.failed,
        status: 'failed',
        error: toolFailureDescriptions.timeout,
        failure: { reason: 'timeout', tool: 'pitchcrew_computer_tabs' },
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain('PRIVATE');
  });

  it('cleans failure text only for the steps that show it', () => {
    // Each cleaning reads the exact secret values once, so the reads count the cleanings.
    let reads = 0;
    const values = ['fixture-secret-0001'];
    const secrets = {
      [Symbol.iterator]: () => {
        reads++;
        return values[Symbol.iterator]();
      },
    } as unknown as string[];
    const { rows, send } = track(secrets);
    const before = reads;
    const long = 'This role cannot export packets. '.repeat(40);
    send(
      // Left to the gateway: a refusal it gave, an interrupted call and a finish it cannot place.
      { phase: 'start', callId: 'refused', kind: 'mcp', pitchcrew: 'pitchcrew_export_packet' },
      { phase: 'finish', callId: 'refused', failed: true, reason: long },
      { phase: 'start', callId: 'stopped', kind: 'mcp', pitchcrew: 'pitchcrew_get_card' },
      {
        phase: 'finish',
        callId: 'stopped',
        failed: true,
        interrupted: true,
        reason: 'MCP error -32001: Request timed out',
      },
      { phase: 'finish', callId: 'unplaced', failed: true, reason: long },
      // Shown without its text: a native call stopped while it ran.
      { phase: 'start', callId: 'halted', kind: 'command' },
      { phase: 'finish', callId: 'halted', failed: true, interrupted: true, reason: long },
    );
    expect(reads).toBe(before);
    expect(rows.map((row) => `${row.id}:${row.status}`)).toEqual([
      'native-halted:running',
      'native-halted:interrupted',
    ]);
    send(
      { phase: 'start', callId: 'failed', kind: 'command' },
      {
        phase: 'finish',
        callId: 'failed',
        failed: true,
        reason: 'Exit code 1: fixture-secret-0001',
      },
    );
    expect(reads).toBe(before + 1);
    expect(rows.at(-1)).toMatchObject({ status: 'failed', error: 'Exit code 1: [redacted]' });
  });

  it('ignores finishes it cannot place and shows calls described only by their finish', () => {
    const { rows, send } = track();
    send(
      { phase: 'finish', callId: 'unknown', failed: true, reason: 'Never started' },
      { phase: 'finish', callId: 'plan', failed: false, kind: 'todo', detail: '1/3 done' },
      { phase: 'finish', callId: 'plan', failed: false, kind: 'todo', detail: '2/3 done' },
      { phase: 'finish', callId: 'patch', failed: true, kind: 'edit', reason: 'Not applied.' },
    );
    expect(rows).toEqual([
      {
        id: 'native-plan',
        kind: 'tool',
        tool: 'todo',
        label: 'Updated plan',
        detail: '1/3 done',
        status: 'completed',
      },
      {
        id: 'native-plan',
        kind: 'tool',
        tool: 'todo',
        label: 'Updated plan',
        detail: '2/3 done',
        status: 'completed',
      },
      expect.objectContaining({ id: 'native-patch', status: 'failed', error: 'Not applied.' }),
    ]);
  });

  it('starts each call once and drops malformed events instead of throwing', () => {
    const { rows, send } = track();
    send(
      { phase: 'start', callId: 'a', kind: 'read' },
      { phase: 'start', callId: 'a', kind: 'command' },
      { phase: 'start', callId: '', kind: 'read' },
      { phase: 'start', callId: 7 as unknown as string, kind: 'read' },
      { phase: 'start', callId: 'b', kind: 'shell' as unknown as 'other' },
      { phase: 'finish', callId: 'c', failed: false, kind: 'shell' as unknown as 'other' },
    );
    expect(rows.map((row) => [row.id, row.tool, row.label])).toEqual([
      ['native-a', 'read', 'Reading file'],
      ['native-b', 'other', 'Using tool'],
      ['native-c', 'other', 'Used tool'],
    ]);
  });

  it('keeps ids in their own namespace and every field bounded', () => {
    const { rows, send } = track();
    for (const callId of ['tool-1', 'commentary-1', 'thinking-1', 'call with spaces'])
      send({ phase: 'start', callId, kind: 'other' });
    send(
      { phase: 'start', callId: 'x'.repeat(300), kind: 'command', detail: 'y'.repeat(500) },
      { phase: 'finish', callId: 'x'.repeat(300), failed: true, reason: 'z'.repeat(900) },
    );
    expect(rows.slice(0, 4).map((row) => row.id)).toEqual([
      'native-tool-1',
      'native-commentary-1',
      'native-thinking-1',
      'native-call_with_spaces',
    ]);
    const failed = rows.at(-1)!;
    expect(failed.id).toHaveLength(160);
    expect(failed.detail).toHaveLength(200);
    expect(failed.error).toHaveLength(300);
  });

  it('remembers a bounded number of unfinished calls', () => {
    const { rows, send } = track();
    for (let index = 0; index < 300; index++)
      send({ phase: 'start', callId: `call-${index}`, kind: 'read' });
    rows.length = 0;
    send(
      { phase: 'finish', callId: 'call-0', failed: false },
      { phase: 'finish', callId: 'call-299', failed: false },
    );
    expect(rows.map((row) => row.id)).toEqual(['native-call-299']);
  });

  it('removes secrets from the environment exactly, then credential shapes', () => {
    const secrets = environmentSecrets({
      PITCHCREW_RUN_TOKEN: 'fixture-run-token-0001',
      ANTHROPIC_API_KEY: 'fixture-provider-0001',
      PITCHCREW_DAEMON_URL: 'http://127.0.0.1:1',
      SHORT_TOKEN: 'abc',
      EMPTY_SECRET: '',
      PATH: '/usr/bin',
    });
    expect(secrets.toSorted()).toEqual(['fixture-provider-0001', 'fixture-run-token-0001']);
    const { rows, send } = track(secrets);
    send(
      {
        phase: 'start',
        callId: 'a',
        kind: 'command',
        detail: 'curl -H "Authorization: Bearer abc123def456" -d fixture-run-token-0001',
      },
      {
        phase: 'finish',
        callId: 'a',
        failed: true,
        reason:
          'Exit code 1: rejected fixture-provider-0001\n\u001b[31mtoken=private-value\u001b[0m',
      },
    );
    const text = JSON.stringify(rows);
    expect(text).not.toMatch(/fixture-run-token|fixture-provider|abc123def456|private-value/);
    expect(rows.at(-1)).toMatchObject({
      detail: 'curl -H "Authorization: [redacted] [redacted]" -d [redacted]',
      error: 'Exit code 1: rejected [redacted] token=[redacted]',
    });
  });
});

describe('activity stream', () => {
  const contextFor = (shape: Record<string, unknown>, signal = new AbortController().signal) =>
    ({ role: { runtime: 'codex' }, signal, onActivity: vi.fn(), ...shape }) as unknown as
      | RunContext
      | ChatContext;

  it('shows chat and deep-review turns, never plain workflow runs', () => {
    expect(showsActivity(contextFor({ messages: [] }))).toBe(true);
    expect(showsActivity(contextFor({ deepReview: { reviewId: 'r' } }))).toBe(true);
    expect(showsActivity(contextFor({}))).toBe(false);
    const workflow = contextFor({});
    activityStream(workflow).tool({ phase: 'start', callId: 'a', kind: 'read' });
    expect(workflow.onActivity).not.toHaveBeenCalled();
  });

  it('ends commentary when a call appears, but not when a started call finishes', () => {
    const context = contextFor({ messages: [] });
    const stream = activityStream(context);
    const statuses = () =>
      vi.mocked(context.onActivity!).mock.calls.map(([entry]) => `${entry.id}:${entry.status}`);
    stream.text('Checking the folder.');
    stream.tool({ phase: 'start', callId: 'a', kind: 'search' });
    stream.text('Still looking.');
    stream.tool({ phase: 'finish', callId: 'a', failed: false });
    stream.tool({ phase: 'finish', callId: 'b', failed: false, kind: 'todo', detail: '1/2 done' });
    expect(statuses()).toEqual([
      'commentary-1:running',
      'commentary-1:completed',
      'native-a:running',
      'commentary-2:running',
      'native-a:completed',
      'commentary-2:completed',
      'native-b:completed',
    ]);
  });

  it('stops showing calls once the turn is cancelled', () => {
    const controller = new AbortController();
    const context = contextFor({ messages: [] }, controller.signal);
    const stream = activityStream(context);
    stream.tool({ phase: 'start', callId: 'a', kind: 'read' });
    controller.abort();
    stream.tool({ phase: 'finish', callId: 'a', failed: false });
    expect(context.onActivity).toHaveBeenCalledOnce();
  });

  // Each call, then how it ended: success, a native failure, a Pitchcrew call the MCP server
  // rejected and one the gateway refused (the gateway reports that one itself).
  const calls: NativeToolEvent[] = [
    { phase: 'start', callId: 'a', kind: 'command', detail: 'npm test' },
    { phase: 'start', callId: 'b', kind: 'command', detail: 'npm run lint' },
    { phase: 'start', callId: 'c', kind: 'mcp', pitchcrew: 'pitchcrew_lint_packet' },
    { phase: 'start', callId: 'd', kind: 'mcp', pitchcrew: 'pitchcrew_export_packet' },
    { phase: 'finish', callId: 'a', failed: false },
    { phase: 'finish', callId: 'b', failed: true, reason: 'Exit code 1: PRIVATE_OUTPUT' },
    {
      phase: 'finish',
      callId: 'c',
      failed: true,
      reason: 'MCP error -32602: Input validation error: PRIVATE_ARG is not a packet',
    },
    { phase: 'finish', callId: 'd', failed: true, reason: 'This role cannot export packets.' },
  ];

  it('gives a run without steps only the closed words of each failed call', () => {
    const onToolFailure = vi.fn();
    const workflow = contextFor({ onToolFailure });
    const stream = activityStream(workflow);
    stream.text('Checking the packet.');
    stream.thinking();
    calls.forEach(stream.tool);
    stream.boundary();
    expect(workflow.onActivity).not.toHaveBeenCalled();
    expect(onToolFailure.mock.calls).toEqual([
      [{ reason: 'tool_error', kind: 'command' }],
      [{ reason: 'invalid_input', tool: 'pitchcrew_lint_packet', kind: 'check' }],
    ]);
  });

  it('reports failures for diagnostics only where no step shows them, and never once cancelled', () => {
    const onToolFailure = vi.fn();
    const chat = contextFor({ messages: [], onToolFailure });
    calls.forEach(activityStream(chat).tool);
    expect(chat.onActivity).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'native-c', failure: expect.any(Object) }),
    );
    const controller = new AbortController();
    const stopped = contextFor({ onToolFailure }, controller.signal);
    const stream = activityStream(stopped);
    controller.abort();
    calls.forEach(stream.tool);
    expect(onToolFailure).not.toHaveBeenCalled();
  });
});

describe('detail helpers', () => {
  it('shows paths relative to the run folder or home and URLs without private parts', () => {
    const run = join(homedir(), '.pitchcrew', 'runs', 'fixture');
    expect(displayPath(join(run, 'notes', 'a.md'), run)).toBe(join('notes', 'a.md'));
    expect(displayPath(run, run)).toBe('.');
    expect(displayPath(join(homedir(), 'Documents', 'cv.md'), run)).toBe(
      join('~', 'Documents', 'cv.md'),
    );
    expect(displayPath(homedir(), run)).toBe('~');
    expect(displayPath('relative/file.md', run)).toBe('relative/file.md');
    expect(displayUrl('https://user:pass@example.com/jobs/1?token=x#apply')).toBe(
      'https://example.com/jobs/1',
    );
    expect(displayUrl('https://example.com/')).toBe('https://example.com');
    expect(displayUrl('data:text/plain;base64,cHJpdmF0ZQ==')).toBe('data:');
    expect(displayUrl('mailto:fixture@example.com')).toBe('mailto:');
    expect(displayUrl('example.com/jobs?ref=x')).toBe('example.com/jobs');
  });

  it('unwraps shell wrappers, reports exits by their last line and counts plan steps', () => {
    expect(commandLine("/bin/zsh -lc 'ls missing-fixture'")).toBe('ls missing-fixture');
    expect(commandLine('bash -lc ls')).toBe('ls');
    expect(commandLine('sh -c "echo one\necho two"')).toBe('echo one');
    expect(commandLine('\n  npm test\nnpm run build')).toBe('npm test');
    expect(commandLine("'a b' && 'c'")).toBe("'a b' && 'c'");
    expect(exitReason(1, 'Traceback\n  File "x"\nValueError: fixture\n\n')).toBe(
      'Exit code 1: ValueError: fixture',
    );
    expect(exitReason(127)).toBe('Exit code 127');
    expect(planProgress([{ done: true }, { done: false }, 'x'], (step) => !!step.done)).toBe(
      '1/3 done',
    );
    expect(planProgress(undefined, () => true)).toBeUndefined();
    expect(
      contentText([
        { type: 'text', text: 'one' },
        { type: 'image', data: 'AAAA' },
      ]),
    ).toBe('one');
    expect(contentText('plain')).toBe('plain');
    expect(contentText({ text: 'object' })).toBe('');
  });
});
