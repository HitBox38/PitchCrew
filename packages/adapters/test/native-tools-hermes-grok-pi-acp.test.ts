import type { ChatContext, RuntimeActivity, RuntimeId } from '@pitchcrew/core';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { acpTools } from '../src/activity/acp-tools.ts';
import { nativeToolTracker, type NativeToolParser } from '../src/activity/native-tools.ts';
import { hermesTools } from '../src/hermes/tools.ts';
import { chatEventStream } from '../src/streaming.ts';

type Event = Record<string, unknown>;
const cwd = resolve('/fictional/run');
const file = (...parts: string[]) => join(cwd, ...parts);
/** ACP text content, as Kiro and Grok send a tool's output. */
const text = (value: string) => ({ type: 'content', content: { type: 'text', text: value } });

/** The tool steps a chat turn shows for these runtime events. */
const stepsFor = (runtime: RuntimeId, events: Event[], secrets: string[] = []) => {
  const onActivity = vi.fn<(entry: RuntimeActivity) => void>();
  const stream = chatEventStream(
    {
      role: { runtime },
      messages: [],
      directory: cwd,
      signal: new AbortController().signal,
      onActivity,
    } as unknown as ChatContext,
    secrets,
  );
  for (const event of events) stream.event(event);
  stream.finish();
  return onActivity.mock.calls.flatMap(([entry]) => (entry.kind === 'tool' ? [entry] : []));
};

/** The tool steps a parser's events become, as acp.ts records them for Kiro. */
const track = (parser: NativeToolParser, events: Event[]) => {
  const steps: RuntimeActivity[] = [];
  const record = nativeToolTracker((entry) => steps.push(entry));
  const parse = parser({ cwd });
  for (const event of events) for (const call of parse(event)) record(call);
  return steps;
};

describe('Hermes tool calls', () => {
  it('shows built-in calls with their target and the reason each failed', () => {
    expect(
      stepsFor('hermes', [
        { type: 'tool_use', name: 'terminal', input: { command: 'cat fictional.md' } },
        {
          type: 'tool_result',
          name: 'terminal',
          output: JSON.stringify({
            output: 'cat: fictional.md: No such file or directory',
            exit_code: 1,
            error: null,
          }),
          duration_ms: 4,
          is_error: true,
        },
        { type: 'tool_use', name: 'read_file', input: { path: file('notes', 'fictional.md') } },
        {
          type: 'tool_result',
          name: 'read_file',
          output: "Error executing tool 'read_file': fictional.md is locked",
          duration_ms: 2,
          is_error: true,
        },
        { type: 'tool_use', name: 'web_search', input: { query: 'Fictional Robotics' } },
        { type: 'tool_result', name: 'web_search', output: '{"result": "…"}', is_error: false },
      ]),
    ).toEqual([
      {
        id: 'native-terminal#1',
        kind: 'tool',
        tool: 'command',
        label: 'Running command',
        detail: 'cat fictional.md',
        status: 'running',
      },
      {
        id: 'native-terminal#1',
        kind: 'tool',
        tool: 'command',
        label: 'Command failed',
        detail: 'cat fictional.md',
        status: 'failed',
        error: 'Exit code 1: cat: fictional.md: No such file or directory',
        failure: { reason: 'tool_error' },
      },
      {
        id: 'native-read_file#2',
        kind: 'tool',
        tool: 'read',
        label: 'Reading file',
        detail: join('notes', 'fictional.md'),
        status: 'running',
      },
      {
        id: 'native-read_file#2',
        kind: 'tool',
        tool: 'read',
        label: "Couldn't read file",
        detail: join('notes', 'fictional.md'),
        status: 'failed',
        error: 'fictional.md is locked',
        failure: { reason: 'tool_error' },
      },
      {
        id: 'native-web_search#3',
        kind: 'tool',
        tool: 'web_search',
        label: 'Searching the web',
        detail: 'Fictional Robotics',
        status: 'running',
      },
      {
        id: 'native-web_search#3',
        kind: 'tool',
        tool: 'web_search',
        label: 'Searched the web',
        detail: 'Fictional Robotics',
        status: 'completed',
      },
    ]);
  });

  it('matches results to unfinished calls of the same tool in the order they started', () => {
    const steps = stepsFor('hermes', [
      { type: 'tool_use', name: 'terminal', input: { command: 'echo one' } },
      { type: 'tool_use', name: 'terminal', input: { command: 'echo two' } },
      { type: 'tool_result', name: 'terminal', output: '{"output": "one", "exit_code": 0}' },
      {
        type: 'tool_result',
        name: 'terminal',
        output: '{"output": "", "exit_code": 3, "error": "two failed"}',
        is_error: true,
      },
    ]);
    expect(steps.filter((step) => step.status !== 'running')).toEqual([
      expect.objectContaining({ detail: 'echo one', status: 'completed' }),
      expect.objectContaining({
        detail: 'echo two',
        status: 'failed',
        error: 'Exit code 3: two failed',
      }),
    ]);
  });

  it('leaves Pitchcrew calls to the daemon unless they failed before reaching it', () => {
    const steps = stepsFor('hermes', [
      {
        type: 'tool_use',
        name: 'mcp_pitchcrew_pitchcrew_get_card',
        input: { cardId: 'PRIVATE_ARG' },
      },
      {
        type: 'tool_result',
        name: 'mcp_pitchcrew_pitchcrew_get_card',
        output: '{"result": "PRIVATE_ARG"}',
        is_error: false,
      },
      {
        type: 'tool_use',
        name: 'mcp_pitchcrew_pitchcrew_get_card',
        input: { cardId: 'PRIVATE_ARG' },
      },
      {
        type: 'tool_result',
        name: 'mcp_pitchcrew_pitchcrew_get_card',
        output: '{"error": "No job PRIVATE_ARG."}',
        is_error: true,
      },
      {
        type: 'tool_use',
        name: 'mcp__pitchcrew__pitchcrew_save_memory',
        input: { text: 'PRIVATE_ARG' },
      },
      {
        type: 'tool_result',
        name: 'mcp__pitchcrew__pitchcrew_save_memory',
        output: JSON.stringify({
          error:
            'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_save_memory: text is required',
        }),
        is_error: true,
      },
      {
        type: 'tool_use',
        name: 'mcp_pitchcrew_gmail_search_messages',
        input: { query: 'PRIVATE_ARG' },
      },
      {
        type: 'tool_result',
        name: 'mcp_pitchcrew_gmail_search_messages',
        output: `{"error": "MCP server 'pitchcrew' is not connected"}`,
        is_error: true,
      },
    ]);
    expect(steps).toEqual([
      {
        id: 'native-mcp__pitchcrew__pitchcrew_save_memory#3',
        kind: 'tool',
        tool: 'edit',
        label: "Couldn't save a memory",
        status: 'failed',
        error:
          'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_save_memory: text is required',
        failure: { reason: 'invalid_input', tool: 'pitchcrew_save_memory' },
      },
      {
        id: 'native-mcp_pitchcrew_gmail_search_messages#4',
        kind: 'tool',
        tool: 'mcp',
        label: "Couldn't read connected sources",
        status: 'failed',
        error: "MCP server 'pitchcrew' is not connected",
        failure: { reason: 'unavailable', tool: 'gmail_search_messages' },
      },
    ]);
    expect(JSON.stringify(steps)).not.toContain('PRIVATE_ARG');
  });

  it('shows a subagent without the goal the model wrote for it', () => {
    const steps = stepsFor('hermes', [
      {
        type: 'tool_use',
        name: 'delegate_task',
        input: {
          goal: 'PRIVATE_ARG Draft a cover letter for Fixture Person',
          context: 'PRIVATE_ARG',
        },
      },
      { type: 'tool_result', name: 'delegate_task', output: '{"result": "PRIVATE_ARG"}' },
    ]);
    expect(steps).toEqual([
      {
        id: 'native-delegate_task#1',
        kind: 'tool',
        tool: 'agent',
        label: 'Running subagent',
        status: 'running',
      },
      {
        id: 'native-delegate_task#1',
        kind: 'tool',
        tool: 'agent',
        label: 'Ran subagent',
        status: 'completed',
      },
    ]);
    expect(JSON.stringify(steps)).not.toContain('PRIVATE_ARG');
  });

  it('stops abandoned calls, reads cut-off results and ignores malformed events', () => {
    const parse = hermesTools({ cwd });
    const events: Event[] = [
      { type: 'tool_use', name: 'terminal', input: 'not an object' },
      {
        type: 'tool_result',
        name: 'terminal',
        output: '[Tool execution cancelled — terminal was abandoned: user interrupted]',
        is_error: false,
      },
      { type: 'tool_use', name: 'terminal', input: { command: 'make' } },
      // Hermes cuts results at 5000 characters.
      {
        type: 'tool_result',
        name: 'terminal',
        output: `{"exit_code": 2, "output": "${'x'.repeat(5000)}...`,
        is_error: true,
      },
      { type: 'tool_use' },
      { type: 'tool_result', name: 7, output: 'Ignored.' },
      { type: 'tool_result', name: 'read_file', output: 42, is_error: true },
    ];
    expect(events.flatMap((event) => parse(event))).toEqual([
      { phase: 'start', callId: 'terminal#1', kind: 'command' },
      { phase: 'finish', callId: 'terminal#1', failed: false, interrupted: true },
      { phase: 'start', callId: 'terminal#2', kind: 'command', detail: 'make' },
      {
        phase: 'finish',
        callId: 'terminal#2',
        failed: true,
        reason: 'Exit code 2',
        failure: 'tool_error',
      },
      // A result without its start names the call itself.
      { phase: 'finish', callId: 'read_file#3', kind: 'read', failed: true },
    ]);
  });
});

describe('Grok tool calls', () => {
  it('shows built-in calls and Pitchcrew calls that failed before reaching the daemon, in either MCP naming', () => {
    const steps = stepsFor('grok', [
      {
        type: 'tool_call',
        toolCallId: 'call_1',
        title: 'Read',
        kind: 'read',
        status: 'in_progress',
        toolName: 'read_file',
        rawInput: { path: file('src', 'main.rs') },
        content: [],
        locations: [],
      },
      {
        type: 'tool_call_update',
        toolCallId: 'call_1',
        status: 'completed',
        content: [],
        rawOutput: { lines: 42 },
        locations: [],
      },
      {
        type: 'tool_call',
        toolCallId: 'call_2',
        title: 'use_tool',
        kind: 'other',
        status: 'in_progress',
        toolName: 'use_tool',
        rawInput: {
          tool_name: 'pitchcrew__pitchcrew_get_card',
          tool_input: { cardId: 'PRIVATE_ARG' },
        },
      },
      {
        type: 'tool_call_update',
        toolCallId: 'call_2',
        status: 'failed',
        content: [text('No job PRIVATE_ARG.')],
      },
      {
        type: 'tool_call',
        toolCallId: 'call_3',
        title: 'pitchcrew__pitchcrew_recall_memory',
        kind: 'other',
        status: 'in_progress',
        toolName: 'pitchcrew__pitchcrew_recall_memory',
        rawInput: { query: 'PRIVATE_ARG' },
      },
      {
        type: 'tool_call_update',
        toolCallId: 'call_3',
        status: 'failed',
        content: [
          text(
            'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_recall_memory: query is too long',
          ),
        ],
      },
    ]);
    expect(steps).toEqual([
      {
        id: 'native-call_1',
        kind: 'tool',
        tool: 'read',
        label: 'Reading file',
        detail: join('src', 'main.rs'),
        status: 'running',
      },
      {
        id: 'native-call_1',
        kind: 'tool',
        tool: 'read',
        label: 'Read file',
        detail: join('src', 'main.rs'),
        status: 'completed',
      },
      {
        id: 'native-call_3',
        kind: 'tool',
        tool: 'search',
        label: "Couldn't recall saved context",
        status: 'failed',
        error:
          'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_recall_memory: query is too long',
        failure: { reason: 'invalid_input', tool: 'pitchcrew_recall_memory' },
      },
    ]);
    expect(JSON.stringify(steps)).not.toContain('PRIVATE_ARG');
  });

  it('shows tool discovery only when it fails, and ignores calls without an id', () => {
    const search = (toolCallId: string) => ({
      type: 'tool_call',
      toolCallId,
      title: 'Search tools',
      kind: 'search',
      status: 'in_progress',
      toolName: 'search_tool',
      rawInput: { query: 'card' },
    });
    expect(
      stepsFor('grok', [
        search('call_4'),
        { type: 'tool_call_update', toolCallId: 'call_4', status: 'completed' },
        search('call_5'),
        {
          type: 'tool_call_update',
          toolCallId: 'call_5',
          status: 'failed',
          content: [text('MCP server pitchcrew is not connected')],
        },
        { type: 'tool_call', toolName: 'pitchcrew__pitchcrew_get_card' },
        { type: 'tool_call_update', rawOutput: 'Ignore me.' },
      ]),
    ).toEqual([
      {
        id: 'native-call_5',
        kind: 'tool',
        tool: 'search',
        label: 'Search failed',
        detail: 'card',
        status: 'failed',
        error: 'MCP server pitchcrew is not connected',
        failure: { reason: 'unavailable' },
      },
    ]);
  });
});

describe('Pi and oh-my-pi tool calls', () => {
  it('shows built-in calls with their target, a command exit code and stopped calls', () => {
    const steps = stepsFor('pi', [
      {
        type: 'tool_execution_start',
        toolCallId: 'call_1',
        toolName: 'bash',
        args: { command: 'ls fictional-dir' },
      },
      { type: 'tool_execution_update', toolCallId: 'call_1', toolName: 'bash', partialResult: {} },
      {
        type: 'tool_execution_end',
        toolCallId: 'call_1',
        toolName: 'bash',
        result: {
          content: [
            {
              type: 'text',
              text: 'ls: fictional-dir: No such file or directory\n\nCommand exited with code 1',
            },
          ],
          details: {},
        },
        isError: true,
        durationMs: 9,
      },
      {
        type: 'tool_execution_start',
        toolCallId: 'call_2',
        toolName: 'read',
        args: { path: file('notes.md') },
      },
      {
        type: 'tool_execution_end',
        toolCallId: 'call_2',
        toolName: 'read',
        result: {
          content: [
            { type: 'image', data: 'PRIVATE_IMAGE', mimeType: 'image/png' },
            { type: 'text', text: 'notes.md is too large to read' },
          ],
          details: { isError: true },
        },
      },
      {
        type: 'tool_execution_start',
        toolCallId: 'call_3',
        toolName: 'grep',
        args: { pattern: 'TODO', path: file('src') },
      },
      {
        type: 'tool_execution_end',
        toolCallId: 'call_3',
        toolName: 'grep',
        result: { content: [{ type: 'text', text: 'Operation aborted' }] },
        isError: true,
      },
    ]);
    expect(steps).toEqual([
      {
        id: 'native-call_1',
        kind: 'tool',
        tool: 'command',
        label: 'Running command',
        detail: 'ls fictional-dir',
        status: 'running',
      },
      {
        id: 'native-call_1',
        kind: 'tool',
        tool: 'command',
        label: 'Command failed',
        detail: 'ls fictional-dir',
        status: 'failed',
        error: 'Exit code 1: ls: fictional-dir: No such file or directory',
        failure: { reason: 'tool_error' },
      },
      {
        id: 'native-call_2',
        kind: 'tool',
        tool: 'read',
        label: 'Reading file',
        detail: 'notes.md',
        status: 'running',
      },
      {
        id: 'native-call_2',
        kind: 'tool',
        tool: 'read',
        label: "Couldn't read file",
        detail: 'notes.md',
        status: 'failed',
        error: 'notes.md is too large to read',
        failure: { reason: 'tool_error' },
      },
      {
        id: 'native-call_3',
        kind: 'tool',
        tool: 'search',
        label: 'Searching files',
        detail: 'TODO in src',
        status: 'running',
      },
      {
        id: 'native-call_3',
        kind: 'tool',
        tool: 'search',
        label: 'Searching files',
        detail: 'TODO in src',
        status: 'interrupted',
      },
    ]);
    expect(JSON.stringify(steps)).not.toContain('PRIVATE_IMAGE');
  });

  it("reads Pi's mcp__pitchcrew__ names and never shows the arguments a call sent", () => {
    const steps = stepsFor('pi', [
      {
        type: 'tool_execution_start',
        toolCallId: 'call_4',
        toolName: 'mcp__pitchcrew__pitchcrew_get_card',
        args: { cardId: 'PRIVATE_ARG' },
      },
      {
        type: 'tool_execution_end',
        toolCallId: 'call_4',
        toolName: 'mcp__pitchcrew__pitchcrew_get_card',
        result: { content: [{ type: 'text', text: '{"card":"PRIVATE_ARG"}' }] },
        isError: false,
      },
      // Refused by the MCP server before the daemon saw it; no start event came first.
      {
        type: 'tool_execution_end',
        toolCallId: 'call_5',
        toolName: 'mcp__pitchcrew__pitchcrew_get_card',
        result: {
          content: [
            {
              type: 'text',
              text: 'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_get_card: Expected string',
            },
          ],
          details: {},
        },
        isError: true,
      },
      {
        type: 'tool_execution_start',
        toolCallId: 'call_6',
        toolName: 'mcp__pitchcrew__pitchcrew_save_memory',
        args: { text: 'PRIVATE_ARG' },
      },
      {
        type: 'tool_execution_end',
        toolCallId: 'call_6',
        toolName: 'mcp__pitchcrew__pitchcrew_save_memory',
        result: {
          content: [
            {
              type: 'text',
              text: 'Validation failed for tool "mcp__pitchcrew__pitchcrew_save_memory":\n  - text: must be string\n\nReceived arguments:\n{\n  "text": "PRIVATE_ARG"\n}',
            },
          ],
          details: {},
        },
        isError: true,
      },
    ]);
    expect(steps).toEqual([
      {
        id: 'native-call_5',
        kind: 'tool',
        tool: 'read',
        label: "Couldn't read job details",
        status: 'failed',
        error:
          'Input validation error: Invalid arguments for tool pitchcrew_get_card: Expected string',
        failure: { reason: 'invalid_input', tool: 'pitchcrew_get_card' },
      },
      {
        id: 'native-call_6',
        kind: 'tool',
        tool: 'edit',
        label: "Couldn't save a memory",
        status: 'failed',
        error:
          'Validation failed for tool "mcp__pitchcrew__pitchcrew_save_memory": - text: must be string',
        failure: { reason: 'invalid_input', tool: 'pitchcrew_save_memory' },
      },
    ]);
    expect(JSON.stringify(steps)).not.toContain('PRIVATE_ARG');
  });

  it("reads oh-my-pi's mcp__pitchcrew_ names, its error prefix and its own MCP timeouts", () => {
    const steps = stepsFor('oh-my-pi', [
      {
        type: 'tool_execution_start',
        toolCallId: 'call_1',
        toolName: 'mcp__pitchcrew_get_card',
        args: { cardId: 'PRIVATE_ARG' },
        intent: 'Reading the attached job',
      },
      {
        type: 'tool_execution_end',
        toolCallId: 'call_1',
        toolName: 'mcp__pitchcrew_get_card',
        result: {
          content: [{ type: 'text', text: 'Error: No job PRIVATE_ARG.' }],
          details: { isError: true },
        },
        isError: true,
      },
      {
        type: 'tool_execution_start',
        toolCallId: 'call_2',
        toolName: 'mcp__pitchcrew_recall_memory',
        args: { query: 'PRIVATE_ARG' },
      },
      {
        type: 'tool_stream_update',
        toolCallId: 'call_2',
        toolName: 'mcp__pitchcrew_recall_memory',
      },
      {
        type: 'tool_execution_end',
        toolCallId: 'call_2',
        toolName: 'mcp__pitchcrew_recall_memory',
        result: {
          content: [
            {
              type: 'text',
              text: [
                'MCP failure',
                'server: pitchcrew',
                'tool: pitchcrew_recall_memory',
                'transport: stdio',
                'stage: request',
                'failure: timeout',
                'retryable: no',
                'message: Request timed out after 30000ms',
                'next: Check server health or increase the MCP timeout; the request outcome is unknown.',
              ].join('\n'),
            },
          ],
          details: {},
        },
        isError: true,
      },
      {
        type: 'tool_execution_end',
        toolCallId: 'call_3',
        toolName: 'mcp__pitchcrew_get_card',
        result: {
          content: [
            {
              type: 'text',
              text: 'Error: MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_get_card: Expected string',
            },
          ],
          details: { isError: true },
        },
        isError: true,
      },
      {
        type: 'tool_execution_end',
        toolCallId: 'call_4',
        toolName: 'mcp__pitchcrew_gmail_search_messages',
        result: {
          content: [],
          details: {
            isError: true,
            error:
              'Validation failed for tool "mcp__pitchcrew_gmail_search_messages":\n  - query: must be string\n\nReceived arguments:\n{"query": 7, "note": "PRIVATE_ARG"}',
          },
        },
        isError: true,
      },
    ]);
    expect(steps).toEqual([
      {
        id: 'native-call_2',
        kind: 'tool',
        tool: 'search',
        label: "Couldn't recall saved context",
        status: 'failed',
        error: 'Request timed out after 30000ms',
        failure: { reason: 'timeout', tool: 'pitchcrew_recall_memory' },
      },
      {
        id: 'native-call_3',
        kind: 'tool',
        tool: 'read',
        label: "Couldn't read job details",
        status: 'failed',
        error:
          'Input validation error: Invalid arguments for tool pitchcrew_get_card: Expected string',
        failure: { reason: 'invalid_input', tool: 'pitchcrew_get_card' },
      },
      {
        id: 'native-call_4',
        kind: 'tool',
        tool: 'mcp',
        label: "Couldn't read connected sources",
        status: 'failed',
        error:
          'Validation failed for tool "mcp__pitchcrew_gmail_search_messages": - query: must be string',
        failure: { reason: 'invalid_input', tool: 'gmail_search_messages' },
      },
    ]);
    expect(JSON.stringify(steps)).not.toContain('PRIVATE_ARG');
  });

  it("removes the runtime's secrets from details and reasons", () => {
    const steps = stepsFor(
      'pi',
      [
        {
          type: 'tool_execution_start',
          toolCallId: 'call_7',
          toolName: 'bash',
          args: { command: 'echo fictional-run-token' },
        },
        {
          type: 'tool_execution_end',
          toolCallId: 'call_7',
          toolName: 'bash',
          result: {
            content: [
              { type: 'text', text: 'rejected fictional-run-token\n\nCommand exited with code 2' },
            ],
          },
          isError: true,
        },
      ],
      ['fictional-run-token'],
    );
    expect(steps.at(-1)).toMatchObject({
      detail: 'echo [redacted]',
      error: 'Exit code 2: rejected [redacted]',
    });
    expect(JSON.stringify(steps)).not.toContain('fictional-run-token');
  });
});

describe('ACP tool calls', () => {
  it('starts a call once it runs and is named, so an update can correct a placeholder', () => {
    const parse = acpTools({ cwd });
    const settled = {
      sessionUpdate: 'tool_call',
      toolCallId: 'tool-2',
      title: 'Search notes',
      kind: 'search',
      status: 'completed',
      rawInput: { pattern: 'TODO', path: file('notes') },
    };
    const updates: Event[] = [
      { sessionUpdate: 'tool_call', toolCallId: 'tool-1', title: '', status: 'pending' },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool-1',
        title: 'Read notes',
        kind: 'read',
        locations: [{ path: file('notes.md') }],
        status: 'in_progress',
      },
      { sessionUpdate: 'tool_call_update', toolCallId: 'tool-1', status: 'completed' },
      // A call can arrive already settled; repeating it does not restart it.
      settled,
      settled,
      // The agent's private reasoning is never a step.
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-3',
        title: 'Thinking',
        kind: 'think',
        status: 'in_progress',
      },
      { sessionUpdate: 'tool_call_update', toolCallId: 'tool-3', status: 'completed' },
    ];
    expect(updates.flatMap((update) => parse(update))).toEqual([
      { phase: 'start', callId: 'tool-1', kind: 'read', detail: 'notes.md' },
      { phase: 'finish', callId: 'tool-1', failed: false },
      { phase: 'start', callId: 'tool-2', kind: 'search', detail: 'TODO in notes' },
      { phase: 'finish', callId: 'tool-2', failed: false },
    ]);
  });

  it('keeps a running status that later updates do not repeat', () => {
    const parse = acpTools({ cwd });
    const updates: Event[] = [
      { sessionUpdate: 'tool_call', toolCallId: 'tool-12', title: '', status: 'in_progress' },
      // Updates carry only the fields that changed: this one names the call, not its status.
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool-12',
        title: 'Read notes',
        kind: 'read',
        locations: [{ path: file('notes.md') }],
      },
      { sessionUpdate: 'tool_call_update', toolCallId: 'tool-12', status: 'completed' },
    ];
    expect(updates.map((update) => parse(update))).toEqual([
      [],
      [{ phase: 'start', callId: 'tool-12', kind: 'read', detail: 'notes.md' }],
      [{ phase: 'finish', callId: 'tool-12', failed: false }],
    ]);
  });

  it('explains failed calls, and shows denied and cancelled ones', () => {
    expect(
      track(acpTools, [
        {
          sessionUpdate: 'tool_call',
          toolCallId: 'tool-4',
          title: 'Run tests',
          kind: 'execute',
          status: 'in_progress',
          rawInput: { command: "bash -lc 'npm test'" },
        },
        {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'tool-4',
          status: 'failed',
          content: [text('Command failed with exit code 1')],
          _meta: { kiro: { failureReason: 'error' } },
        },
        {
          sessionUpdate: 'tool_call',
          toolCallId: 'tool-5',
          title: 'Delete drafts',
          kind: 'delete',
          status: 'pending',
          rawInput: { path: file('drafts') },
        },
        {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'tool-5',
          status: 'failed',
          _meta: { kiro: { failureReason: 'denied' } },
        },
        {
          sessionUpdate: 'tool_call',
          toolCallId: 'tool-6',
          title: 'Fetch page',
          kind: 'fetch',
          status: 'in_progress',
          rawInput: { url: 'https://example.com/jobs?token=PRIVATE_ARG' },
        },
        {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'tool-6',
          status: 'failed',
          _meta: { kiro: { failureReason: 'cancelled' } },
        },
      ]),
    ).toEqual([
      {
        id: 'native-tool-4',
        kind: 'tool',
        tool: 'command',
        label: 'Running command',
        detail: 'npm test',
        status: 'running',
      },
      {
        id: 'native-tool-4',
        kind: 'tool',
        tool: 'command',
        label: 'Command failed',
        detail: 'npm test',
        status: 'failed',
        error: 'Command failed with exit code 1',
        failure: { reason: 'tool_error' },
      },
      {
        id: 'native-tool-5',
        kind: 'tool',
        tool: 'edit',
        label: 'Editing file',
        detail: 'drafts',
        status: 'running',
      },
      {
        id: 'native-tool-5',
        kind: 'tool',
        tool: 'edit',
        label: "Couldn't edit file",
        detail: 'drafts',
        status: 'failed',
        error: 'This run is not allowed to use that tool or action.',
        failure: { reason: 'not_allowed' },
      },
      {
        id: 'native-tool-6',
        kind: 'tool',
        tool: 'fetch',
        label: 'Fetching page',
        detail: 'https://example.com/jobs',
        status: 'running',
      },
      {
        id: 'native-tool-6',
        kind: 'tool',
        tool: 'fetch',
        label: 'Fetching page',
        detail: 'https://example.com/jobs',
        status: 'interrupted',
      },
    ]);
  });

  it("leaves Pitchcrew calls to the daemon, by title or Kiro's identity, unless they failed before reaching it", () => {
    const steps = track(acpTools, [
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-7',
        title: '@pitchcrew/pitchcrew_get_card',
        kind: 'other',
        status: 'pending',
        rawInput: { cardId: 'PRIVATE_ARG' },
      },
      { sessionUpdate: 'tool_call_update', toolCallId: 'tool-7', status: 'in_progress' },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool-7',
        status: 'completed',
        content: [text('{"card":"PRIVATE_ARG"}')],
      },
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-8',
        title: 'Import job',
        kind: 'fetch',
        status: 'in_progress',
        rawInput: { url: 'https://example.com/PRIVATE_ARG' },
        _meta: {
          kiro: {
            mcpTool: {
              version: 1,
              identity: { serverName: 'pitchcrew', toolName: 'pitchcrew_import_job_link' },
            },
          },
        },
      },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool-8',
        status: 'failed',
        content: [
          text(
            'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_import_job_link: url must use https',
          ),
        ],
        _meta: { kiro: { failureReason: 'error' } },
      },
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-9',
        title: 'pitchcrew_save_memory',
        status: 'in_progress',
        rawInput: { text: 'PRIVATE_ARG' },
      },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool-9',
        status: 'failed',
        content: [text('No memory PRIVATE_ARG.')],
      },
    ]);
    expect(steps).toEqual([
      {
        id: 'native-tool-8',
        kind: 'tool',
        tool: 'fetch',
        label: "Couldn't read job link",
        status: 'failed',
        error:
          'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_import_job_link: url must use https',
        failure: { reason: 'invalid_input', tool: 'pitchcrew_import_job_link' },
      },
    ]);
    expect(JSON.stringify(steps)).not.toContain('PRIVATE_ARG');
  });

  it("reads the Kiro v2 engine's identity and titles, so its Pitchcrew calls stay with the daemon", () => {
    /** Kiro 2.26's v2 engine: a `Running: @server/tool` title and the identity in `_meta.kiro`. */
    const v2Call = (toolCallId: string, tool: string, rawInput: Event): Event => ({
      sessionUpdate: 'tool_call',
      toolCallId,
      title: `Running: @pitchcrew/${tool}`,
      kind: 'other',
      status: 'pending',
      rawInput,
      _meta: { kiro: { toolName: tool, mcpServerName: 'pitchcrew' } },
    });
    const update = (toolCallId: string, status: string, output?: string): Event => ({
      sessionUpdate: 'tool_call_update',
      toolCallId,
      status,
      ...(output ? { content: [text(output)] } : {}),
    });
    const steps = track(acpTools, [
      v2Call('tool-13', 'pitchcrew_recall_memory', { query: 'PRIVATE_ARG' }),
      update('tool-13', 'in_progress'),
      update('tool-13', 'completed', '{"memories":["PRIVATE_ARG"]}'),
      // The daemon refused this call and recorded why; Kiro's copy of the refusal stays hidden.
      v2Call('tool-14', 'pitchcrew_computer_execute', { text: 'PRIVATE_ARG' }),
      update('tool-14', 'in_progress'),
      update('tool-14', 'failed', 'locator.fill: Timeout 5000ms exceeded. Typing "PRIVATE_ARG"'),
      v2Call('tool-15', 'pitchcrew_save_memory', { text: 'PRIVATE_ARG' }),
      update(
        'tool-15',
        'failed',
        'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_save_memory: text is required',
      ),
      // Without the identity, the title still names the server.
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-16',
        title: 'Running: @pitchcrew/pitchcrew_get_card',
        kind: 'other',
        status: 'in_progress',
        rawInput: { cardId: 'PRIVATE_ARG' },
      },
      update('tool-16', 'failed', 'No job PRIVATE_ARG.'),
      // A built-in tool names no server, so it stays a native step.
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-17',
        title: 'Running: npm test',
        kind: 'execute',
        status: 'in_progress',
        rawInput: { command: 'npm test' },
        _meta: { kiro: { toolName: 'execute_bash' } },
      },
      update('tool-17', 'completed'),
    ]);
    expect(steps).toEqual([
      {
        id: 'native-tool-15',
        kind: 'tool',
        tool: 'edit',
        label: "Couldn't save a memory",
        status: 'failed',
        error:
          'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_save_memory: text is required',
        failure: { reason: 'invalid_input', tool: 'pitchcrew_save_memory' },
      },
      {
        id: 'native-tool-17',
        kind: 'tool',
        tool: 'command',
        label: 'Running command',
        detail: 'npm test',
        status: 'running',
      },
      {
        id: 'native-tool-17',
        kind: 'tool',
        tool: 'command',
        label: 'Ran command',
        detail: 'npm test',
        status: 'completed',
      },
    ]);
    expect(JSON.stringify(steps)).not.toContain('PRIVATE_ARG');
  });

  it('ignores updates without a call id and tolerates malformed fields', () => {
    const parse = acpTools({ cwd });
    const updates: Event[] = [
      { sessionUpdate: 'tool_call', title: 'No id', status: 'in_progress' },
      { sessionUpdate: 'agent_message_chunk', toolCallId: 'tool-10', title: 'Not a call' },
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-10',
        title: 'Run',
        kind: ['execute'],
        locations: 'nowhere',
        rawInput: 'ls',
        content: 'oops',
        _meta: 'none',
        status: 'in_progress',
      },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool-10',
        status: 'failed',
        content: [null, 5, { type: 'content' }],
        rawOutput: { error: { code: 1 } },
      },
      { sessionUpdate: 'tool_call_update', toolCallId: 'tool-11', status: 'completed' },
    ];
    expect(updates.flatMap((update) => parse(update))).toEqual([
      { phase: 'start', callId: 'tool-10', kind: 'other', detail: 'Run' },
      { phase: 'finish', callId: 'tool-10', failed: true },
    ]);
  });
});
