import type { ActivityToolKind, ChatContext, RuntimeActivity, RuntimeId } from '@pitchcrew/core';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type {
  NativeToolEvent,
  NativeToolFinish,
  NativeToolParser,
  NativeToolStart,
} from '../src/activity/native-tools.ts';
import { copilotCliTools } from '../src/copilot-cli/tools.ts';
import { cursorAgentTools } from '../src/cursor-agent/tools.ts';
import { geminiCliTools } from '../src/gemini-cli/tools.ts';
import { gooseTools } from '../src/goose/tools.ts';
import { chatEventStream } from '../src/streaming.ts';

type Event = Record<string, unknown>;
interface Case {
  name: string;
  events: Event[];
  /** What the runtime's parser normalizes the events to. */
  parsed: NativeToolEvent[];
  /** The tool steps a chat turn shows for them. */
  rows: RuntimeActivity[];
}

const cwd = join(tmpdir(), 'fictional-run');
const relativePlanPath = join('notes', 'plan.md');
const planPath = join(cwd, relativePlanPath);
const missingPath = join(cwd, 'missing.md');

const parse = (parser: NativeToolParser, events: Event[]) => {
  const read = parser({ cwd });
  return events.flatMap((event) => read(event));
};

const steps = (runtime: RuntimeId, events: Event[], secrets: string[] = []) => {
  const onActivity = vi.fn<(entry: RuntimeActivity) => void>();
  const context = {
    role: { runtime },
    messages: [],
    directory: cwd,
    signal: new AbortController().signal,
    onActivity,
  } as unknown as ChatContext;
  const stream = chatEventStream(context, secrets);
  for (const event of events) stream.event(event);
  stream.finish();
  return onActivity.mock.calls.map(([entry]) => entry).filter((entry) => entry.kind === 'tool');
};

const start = (
  callId: string,
  kind: ActivityToolKind,
  more: Partial<NativeToolStart> = {},
): NativeToolEvent => ({ phase: 'start', callId, kind, ...more });
const finish = (
  callId: string,
  failed: boolean,
  more: Partial<NativeToolFinish> = {},
): NativeToolEvent => ({ phase: 'finish', callId, failed, ...more });
/** A tool step as the chat shows it; `id` follows the `native-` prefix. */
const row = (
  id: string,
  tool: ActivityToolKind,
  label: string,
  status: RuntimeActivity['status'],
  more: Partial<RuntimeActivity> = {},
): RuntimeActivity => ({ id: `native-${id}`, kind: 'tool', tool, label, status, ...more });

const validationError =
  'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_get_card: expected string';
const rejectedCard = {
  error: validationError,
  failure: { reason: 'invalid_input' as const, tool: 'pitchcrew_get_card' },
};

const geminiUse = (id: string, name: string, parameters: Event = {}) => ({
  type: 'tool_use',
  timestamp: '2026-11-17T10:00:00.000Z',
  tool_name: name,
  tool_id: id,
  parameters,
});
const geminiResult = (id: string, result: Event) => ({
  type: 'tool_result',
  timestamp: '2026-11-17T10:00:01.000Z',
  tool_id: id,
  ...result,
});
const geminiError = (type: string, message: string) => ({
  status: 'error',
  output: message,
  error: { type, message },
});
/** Gemini's `mcp_tool_error`: its message embeds the call's arguments and the raw MCP result. */
const mcpToolError = (name: string, tool: string, args: Event, response: Event) => ({
  status: 'error',
  output: `Error: MCP tool '${tool}' reported an error.`,
  error: {
    type: 'mcp_tool_error',
    message: `MCP tool '${tool}' reported tool error for function call: ${JSON.stringify({
      name,
      args,
    })} with response: ${JSON.stringify([{ functionResponse: { name, response } }])}`,
  },
});
const mcpText = (text: string) => ({ content: [{ type: 'text', text }], isError: true });
const notRegistered = 'Tool "run_shell_command" not found.';
const missingCardId = "params must have required property 'cardId'";
const deniedByPolicy = 'Tool execution denied by policy.';
const jobPage = 'https://jobs.example.com/roles/42';

const geminiCases: Case[] = [
  {
    name: 'a built-in tool Gemini did not register fails with its readable reason',
    events: [
      geminiUse('shell-1', 'run_shell_command', {
        command: 'git status --short\ngit diff',
        description: 'Check the tree',
      }),
      geminiResult(
        'shell-1',
        geminiError('tool_not_registered', `${notRegistered} Did you mean one of: "mcp_x"?`),
      ),
    ],
    parsed: [
      start('shell-1', 'command', { detail: 'git status --short' }),
      finish('shell-1', true, { reason: notRegistered, failure: 'not_found', preGateway: true }),
    ],
    rows: [
      row('shell-1', 'command', 'Running command', 'running', { detail: 'git status --short' }),
      row('shell-1', 'command', 'Command failed', 'failed', {
        detail: 'git status --short',
        error: notRegistered,
        failure: { reason: 'not_found' },
      }),
    ],
  },
  {
    name: 'a non-zero exit reported as success stays done; paths show from the run folder',
    events: [
      geminiUse('shell-2', 'run_shell_command', { command: 'npm test' }),
      geminiResult('shell-2', { status: 'success', output: 'Command exited with code: 1' }),
      geminiUse('read-3', 'read_file', { file_path: planPath }),
      geminiResult('read-3', { status: 'success', output: 'PRIVATE_ARG' }),
    ],
    parsed: [
      start('shell-2', 'command', { detail: 'npm test' }),
      finish('shell-2', false),
      start('read-3', 'read', { detail: relativePlanPath }),
      finish('read-3', false),
    ],
    rows: [
      row('shell-2', 'command', 'Running command', 'running', { detail: 'npm test' }),
      row('shell-2', 'command', 'Ran command', 'completed', { detail: 'npm test' }),
      row('read-3', 'read', 'Reading file', 'running', { detail: relativePlanPath }),
      row('read-3', 'read', 'Read file', 'completed', { detail: relativePlanPath }),
    ],
  },
  {
    name: 'a plan update shows its progress, never its items',
    events: [
      geminiUse('todos-4', 'write_todos', {
        todos: [
          { description: 'PRIVATE_ARG', status: 'completed' },
          { description: 'PRIVATE_ARG', status: 'in_progress' },
          { description: 'PRIVATE_ARG', status: 'pending' },
        ],
      }),
      geminiResult('todos-4', { status: 'success', output: 'PRIVATE_ARG' }),
    ],
    parsed: [start('todos-4', 'todo', { detail: '1/3 done' }), finish('todos-4', false)],
    rows: [
      row('todos-4', 'todo', 'Updating plan', 'running', { detail: '1/3 done' }),
      row('todos-4', 'todo', 'Updated plan', 'completed', { detail: '1/3 done' }),
    ],
  },
  {
    name: "a policy denial shows the page's address without its query",
    events: [
      geminiUse('fetch-5', 'web_fetch', {
        prompt: `Summarize ${jobPage}?ref=PRIVATE_ARG for me.`,
      }),
      geminiResult('fetch-5', geminiError('policy_violation', deniedByPolicy)),
    ],
    parsed: [
      start('fetch-5', 'fetch', { detail: jobPage }),
      finish('fetch-5', true, { reason: deniedByPolicy, failure: 'not_allowed', preGateway: true }),
    ],
    rows: [
      row('fetch-5', 'fetch', 'Fetching page', 'running', { detail: jobPage }),
      row('fetch-5', 'fetch', "Couldn't fetch page", 'failed', {
        detail: jobPage,
        error: deniedByPolicy,
        failure: { reason: 'not_allowed' },
      }),
    ],
  },
  {
    name: 'Pitchcrew and connector calls the daemon answered are left to the gateway',
    events: [
      geminiUse('card-6', 'mcp_pitchcrew_pitchcrew_get_card', { cardId: 'PRIVATE_ARG' }),
      geminiResult(
        'card-6',
        mcpToolError(
          'mcp_pitchcrew_pitchcrew_get_card',
          'pitchcrew_get_card',
          { cardId: 'PRIVATE_ARG' },
          mcpText('Card PRIVATE_ARG was not found.'),
        ),
      ),
      geminiUse('github-7', 'mcp_pitchcrew_github_read_file', { path: 'PRIVATE_ARG' }),
      geminiResult('github-7', { status: 'success', output: 'PRIVATE_ARG' }),
    ],
    parsed: [
      start('card-6', 'mcp', { pitchcrew: 'pitchcrew_get_card' }),
      finish('card-6', true, { failure: 'tool_error', preGateway: false }),
      start('github-7', 'mcp', { pitchcrew: 'github_read_file' }),
      finish('github-7', false),
    ],
    rows: [],
  },
  {
    name: 'a Pitchcrew call Gemini refused before sending it shows once',
    events: [
      geminiUse('card-8', 'mcp_pitchcrew_pitchcrew_get_card'),
      geminiResult('card-8', geminiError('invalid_tool_params', missingCardId)),
    ],
    parsed: [
      start('card-8', 'mcp', { pitchcrew: 'pitchcrew_get_card' }),
      finish('card-8', true, { reason: missingCardId, failure: 'invalid_input', preGateway: true }),
    ],
    rows: [
      row('card-8', 'read', "Couldn't read job details", 'failed', {
        error: missingCardId,
        failure: { reason: 'invalid_input', tool: 'pitchcrew_get_card' },
      }),
    ],
  },
  {
    name: "an MCP SDK refusal shows a fixed sentence, never the message's embedded arguments",
    events: [
      geminiUse('card-9', 'mcp_pitchcrew_pitchcrew_get_card', { cardId: 'PRIVATE_ARG' }),
      geminiResult(
        'card-9',
        mcpToolError(
          'mcp_pitchcrew_pitchcrew_get_card',
          'pitchcrew_get_card',
          { cardId: 'PRIVATE_ARG' },
          mcpText(`${validationError}, received PRIVATE_ARG`),
        ),
      ),
    ],
    parsed: [
      start('card-9', 'mcp', { pitchcrew: 'pitchcrew_get_card' }),
      finish('card-9', true, { failure: 'invalid_input', preGateway: true }),
    ],
    rows: [
      row('card-9', 'read', "Couldn't read job details", 'failed', {
        error: 'The tool rejected the arguments it was given.',
        failure: { reason: 'invalid_input', tool: 'pitchcrew_get_card' },
      }),
    ],
  },
  {
    name: "a connector call Gemini's MCP client gave up on shows once",
    events: [
      geminiUse('gmail-10', 'mcp_pitchcrew_gmail_search_messages', { query: 'PRIVATE_ARG' }),
      geminiResult(
        'gmail-10',
        mcpToolError(
          'mcp_pitchcrew_gmail_search_messages',
          'gmail_search_messages',
          { query: 'PRIVATE_ARG' },
          { error: { message: 'MCP error -32001: Request timed out', isError: true } },
        ),
      ),
    ],
    parsed: [
      start('gmail-10', 'mcp', { pitchcrew: 'gmail_search_messages' }),
      finish('gmail-10', true, { failure: 'timeout', preGateway: true }),
    ],
    rows: [
      row('gmail-10', 'mcp', "Couldn't read connected sources", 'failed', {
        error: 'The tool did not finish in time.',
        failure: { reason: 'timeout', tool: 'gmail_search_messages' },
      }),
    ],
  },
  {
    name: "another server's MCP failure shows the tool's name and a fixed sentence",
    events: [
      geminiUse('notes-11', 'mcp_notes_lookup', { query: 'PRIVATE_ARG' }),
      geminiResult(
        'notes-11',
        mcpToolError(
          'mcp_notes_lookup',
          'lookup',
          { query: 'PRIVATE_ARG' },
          mcpText('PRIVATE_ARG is missing.'),
        ),
      ),
    ],
    parsed: [
      start('notes-11', 'mcp', { detail: 'notes_lookup' }),
      finish('notes-11', true, { failure: 'tool_error', preGateway: false }),
    ],
    rows: [
      row('notes-11', 'mcp', 'Calling tool', 'running', { detail: 'notes_lookup' }),
      row('notes-11', 'mcp', 'Tool call failed', 'failed', {
        detail: 'notes_lookup',
        error: 'The tool ran and reported a failure.',
        failure: { reason: 'tool_error' },
      }),
    ],
  },
];

const copilot = (type: string, data: Event, envelope: Event = {}) => ({
  type,
  id: `event-${String(data.toolCallId ?? data.messageId)}`,
  timestamp: '2026-11-17T10:00:00.000Z',
  parentId: null,
  ...envelope,
  data,
});
const copilotStart = (toolCallId: string, toolName: string, args: Event, more: Event = {}) =>
  copilot('tool.execution_start', { toolCallId, toolName, arguments: args, ...more });
const copilotDone = (toolCallId: string, success: boolean, more: Event = {}) =>
  copilot('tool.execution_complete', { toolCallId, success, ...more });
const copilotCard = (toolCallId: string) =>
  copilotStart(
    toolCallId,
    'pitchcrew-pitchcrew_get_card',
    { cardId: 'PRIVATE_ARG' },
    { mcpServerName: 'pitchcrew', mcpToolName: 'pitchcrew_get_card' },
  );
const missingScript = 'npm ERR! Missing script: "test"';
const permissionDenied = 'Permission denied and could not request permission from user';

const copilotCases: Case[] = [
  {
    name: 'a failed command shows its exit code and why',
    events: [
      copilotStart(
        'toolu_01',
        'bash',
        { command: 'npm test', description: 'Run the tests' },
        { toolTitle: 'Running command' },
      ),
      copilotDone('toolu_01', false, {
        error: { message: missingScript, code: 'failure' },
        shellExecution: { exitCode: 1 },
      }),
    ],
    parsed: [
      start('toolu_01', 'command', { detail: 'npm test' }),
      finish('toolu_01', true, { reason: `Exit code 1: ${missingScript}`, failure: 'tool_error' }),
    ],
    rows: [
      row('toolu_01', 'command', 'Running command', 'running', { detail: 'npm test' }),
      row('toolu_01', 'command', 'Command failed', 'failed', {
        detail: 'npm test',
        error: `Exit code 1: ${missingScript}`,
        failure: { reason: 'tool_error' },
      }),
    ],
  },
  {
    name: 'a non-zero exit fails the call even when Copilot reports success',
    events: [
      copilotStart('toolu_02', 'bash', { command: 'ls missing' }),
      copilotDone('toolu_02', true, {
        shellExecution: { exitCode: 2 },
        result: {
          content:
            'ls: missing: No such file or directory\n<shellId: 0 completed with exit code 2>',
        },
      }),
    ],
    parsed: [
      start('toolu_02', 'command', { detail: 'ls missing' }),
      finish('toolu_02', true, {
        reason: 'Exit code 2: ls: missing: No such file or directory',
        failure: 'tool_error',
      }),
    ],
    rows: [
      row('toolu_02', 'command', 'Running command', 'running', { detail: 'ls missing' }),
      row('toolu_02', 'command', 'Command failed', 'failed', {
        detail: 'ls missing',
        error: 'Exit code 2: ls: missing: No such file or directory',
        failure: { reason: 'tool_error' },
      }),
    ],
  },
  {
    name: 'a file read completes with its path from the run folder',
    events: [
      copilotStart('toolu_03', 'view', { path: planPath }),
      copilotDone('toolu_03', true, { result: { content: 'PRIVATE_ARG' } }),
    ],
    parsed: [start('toolu_03', 'read', { detail: relativePlanPath }), finish('toolu_03', false)],
    rows: [
      row('toolu_03', 'read', 'Reading file', 'running', { detail: relativePlanPath }),
      row('toolu_03', 'read', 'Read file', 'completed', { detail: relativePlanPath }),
    ],
  },
  {
    name: 'Pitchcrew and connector calls the daemon answered are left to the gateway',
    events: [
      copilotCard('toolu_04'),
      copilotDone('toolu_04', false, { error: { message: 'Card PRIVATE_ARG was not found.' } }),
      // An older event: a display name in mcpServerName, the configured key beside it.
      copilotStart(
        'toolu_05',
        'pitchcrew-github_read_file',
        { path: 'PRIVATE_ARG' },
        { mcpConfigServerName: 'pitchcrew', mcpServerName: 'Pitchcrew tools' },
      ),
      copilotDone('toolu_05', true, { result: { content: 'PRIVATE_ARG' } }),
    ],
    parsed: [
      start('toolu_04', 'mcp', { pitchcrew: 'pitchcrew_get_card' }),
      finish('toolu_04', true, { reason: 'Card PRIVATE_ARG was not found.' }),
      start('toolu_05', 'mcp', { pitchcrew: 'github_read_file' }),
      finish('toolu_05', false),
    ],
    rows: [],
  },
  {
    name: 'a Pitchcrew call the MCP server rejected shows once',
    events: [
      copilotCard('toolu_06'),
      copilotDone('toolu_06', false, { error: { message: validationError } }),
    ],
    parsed: [
      start('toolu_06', 'mcp', { pitchcrew: 'pitchcrew_get_card' }),
      finish('toolu_06', true, { reason: validationError }),
    ],
    rows: [row('toolu_06', 'read', "Couldn't read job details", 'failed', rejectedCard)],
  },
  {
    name: 'calls refused before they started are described from their request',
    events: [
      copilot('assistant.message', {
        messageId: 'message-1',
        content: '',
        toolRequests: [
          { toolCallId: 'toolu_07', name: 'bash', arguments: { command: 'rm -rf build' } },
          {
            toolCallId: 'toolu_08',
            name: 'pitchcrew-pitchcrew_export_packet',
            mcpServerName: 'pitchcrew',
            mcpToolName: 'pitchcrew_export_packet',
            arguments: { cardId: 'PRIVATE_ARG' },
          },
        ],
      }),
      copilotDone('toolu_07', false, { error: { message: permissionDenied } }),
      copilotDone('toolu_08', false, { error: { message: permissionDenied } }),
    ],
    parsed: [
      finish('toolu_07', true, {
        reason: permissionDenied,
        kind: 'command',
        detail: 'rm -rf build',
        preGateway: true,
      }),
      finish('toolu_08', true, {
        reason: permissionDenied,
        kind: 'mcp',
        pitchcrew: 'pitchcrew_export_packet',
        preGateway: true,
      }),
    ],
    rows: [
      row('toolu_07', 'command', 'Command failed', 'failed', {
        detail: 'rm -rf build',
        error: permissionDenied,
        failure: { reason: 'not_allowed' },
      }),
      row('toolu_08', 'edit', "Couldn't export approved packet", 'failed', {
        error: permissionDenied,
        failure: { reason: 'not_allowed', tool: 'pitchcrew_export_packet' },
      }),
    ],
  },
  {
    name: "a sub-agent's tool calls are not this turn's steps",
    events: [
      copilot(
        'tool.execution_start',
        { toolCallId: 'toolu_09', toolName: 'view', arguments: { path: 'README.md' } },
        { agentId: 'agent-1' },
      ),
      copilot(
        'tool.execution_complete',
        { toolCallId: 'toolu_09', success: false, error: { message: 'PRIVATE_ARG' } },
        { agentId: 'agent-1' },
      ),
      copilotStart('toolu_10', 'bash', { command: 'ls' }, { parentToolCallId: 'toolu_task' }),
    ],
    parsed: [],
    rows: [],
  },
];

const cursorCall = (subtype: 'started' | 'completed', callId: string, call: Event) => ({
  type: 'tool_call',
  subtype,
  call_id: callId,
  // Sibling keys come first, as in captured streams.
  tool_call: { toolCallId: callId, startedAtMs: '1763373600', hookAdditionalContexts: [], ...call },
  session_id: 'fictional-session',
});
const cursorShell = (command: string, result?: Event) => ({
  shellToolCall: { args: { command }, ...(result && { result }) },
});
const cursorMcp = (server: string, tool: string, result?: Event) => ({
  mcpToolCall: {
    args: {
      name: `${server}-${tool}`,
      args: { query: 'PRIVATE_ARG' },
      providerIdentifier: server,
      toolName: tool,
    },
    ...(result && { result }),
  },
});

const cursorCases: Case[] = [
  {
    name: "a shell call the run's permissions rejected shows why",
    events: [
      cursorCall('started', 'tool_1a2b', cursorShell('git status --short')),
      cursorCall(
        'completed',
        'tool_1a2b',
        cursorShell('git status --short', {
          rejected: { command: 'git status --short', reason: '' },
        }),
      ),
    ],
    parsed: [
      start('tool_1a2b', 'command', { detail: 'git status --short' }),
      finish('tool_1a2b', true, { failure: 'not_allowed', preGateway: true }),
    ],
    rows: [
      row('tool_1a2b', 'command', 'Running command', 'running', { detail: 'git status --short' }),
      row('tool_1a2b', 'command', 'Command failed', 'failed', {
        detail: 'git status --short',
        error: 'This run is not allowed to use that tool or action.',
        failure: { reason: 'not_allowed' },
      }),
    ],
  },
  {
    name: 'a failed command shows its exit code and why',
    events: [
      cursorCall('started', 'tool_3c4d', cursorShell('npm test')),
      cursorCall(
        'completed',
        'tool_3c4d',
        cursorShell('npm test', {
          failure: { exitCode: 1, signal: '', stdout: 'PRIVATE_ARG', stderr: `${missingScript}\n` },
        }),
      ),
    ],
    parsed: [
      start('tool_3c4d', 'command', { detail: 'npm test' }),
      finish('tool_3c4d', true, { reason: `Exit code 1: ${missingScript}`, failure: 'tool_error' }),
    ],
    rows: [
      row('tool_3c4d', 'command', 'Running command', 'running', { detail: 'npm test' }),
      row('tool_3c4d', 'command', 'Command failed', 'failed', {
        detail: 'npm test',
        error: `Exit code 1: ${missingScript}`,
        failure: { reason: 'tool_error' },
      }),
    ],
  },
  {
    name: 'a read completes, and an id with a newline stays one step',
    events: [
      cursorCall('started', 'call_x\nfc_y', {
        readToolCall: { args: { path: planPath } },
      }),
      cursorCall('completed', 'call_x\nfc_y', {
        readToolCall: { result: { success: { content: 'PRIVATE_ARG', totalLines: 1 } } },
      }),
    ],
    parsed: [
      start('call_x\nfc_y', 'read', { detail: relativePlanPath }),
      finish('call_x\nfc_y', false),
    ],
    rows: [
      row('call_x_fc_y', 'read', 'Reading file', 'running', { detail: relativePlanPath }),
      row('call_x_fc_y', 'read', 'Read file', 'completed', { detail: relativePlanPath }),
    ],
  },
  {
    name: 'Pitchcrew and connector calls the daemon answered are left to the gateway',
    events: [
      cursorCall('started', 'toolu_05', cursorMcp('pitchcrew', 'pitchcrew_get_card')),
      cursorCall(
        'completed',
        'toolu_05',
        cursorMcp('pitchcrew', 'pitchcrew_get_card', {
          success: {
            content: [{ text: { text: 'Card PRIVATE_ARG was not found.' } }],
            isError: true,
          },
        }),
      ),
      cursorCall('started', 'toolu_06', cursorMcp('pitchcrew', 'gmail_search_messages')),
      cursorCall(
        'completed',
        'toolu_06',
        cursorMcp('pitchcrew', 'gmail_search_messages', {
          success: { content: [{ text: { text: 'PRIVATE_ARG' } }], isError: false },
        }),
      ),
    ],
    parsed: [
      start('toolu_05', 'mcp', { pitchcrew: 'pitchcrew_get_card' }),
      finish('toolu_05', true, { reason: 'Card PRIVATE_ARG was not found.' }),
      start('toolu_06', 'mcp', { pitchcrew: 'gmail_search_messages' }),
      finish('toolu_06', false),
    ],
    rows: [],
  },
  {
    name: 'a Pitchcrew call the MCP server rejected shows once',
    events: [
      cursorCall('started', 'toolu_07', cursorMcp('pitchcrew', 'pitchcrew_get_card')),
      cursorCall(
        'completed',
        'toolu_07',
        cursorMcp('pitchcrew', 'pitchcrew_get_card', { success: mcpText(validationError) }),
      ),
    ],
    parsed: [
      start('toolu_07', 'mcp', { pitchcrew: 'pitchcrew_get_card' }),
      finish('toolu_07', true, { reason: validationError }),
    ],
    rows: [row('toolu_07', 'read', "Couldn't read job details", 'failed', rejectedCard)],
  },
  {
    name: "another server's MCP error names the tool and its server",
    events: [
      cursorCall('started', 'toolu_08', cursorMcp('notes', 'lookup')),
      cursorCall(
        'completed',
        'toolu_08',
        cursorMcp('notes', 'lookup', { error: { errorMessage: 'Notes service unavailable' } }),
      ),
    ],
    parsed: [
      start('toolu_08', 'mcp', { detail: 'lookup (notes)' }),
      finish('toolu_08', true, { reason: 'Notes service unavailable' }),
    ],
    rows: [
      row('toolu_08', 'mcp', 'Calling tool', 'running', { detail: 'lookup (notes)' }),
      row('toolu_08', 'mcp', 'Tool call failed', 'failed', {
        detail: 'lookup (notes)',
        error: 'Notes service unavailable',
        failure: { reason: 'unavailable' },
      }),
    ],
  },
  {
    name: 'a call that never completes stays running, and an aborted one is interrupted',
    events: [
      cursorCall('started', 'tool_9', cursorShell('sleep 60')),
      cursorCall('started', 'tool_10', cursorShell('npm run watch')),
      cursorCall(
        'completed',
        'tool_10',
        cursorShell('npm run watch', { failure: { exitCode: 130, aborted: true, stderr: '' } }),
      ),
    ],
    parsed: [
      start('tool_9', 'command', { detail: 'sleep 60' }),
      start('tool_10', 'command', { detail: 'npm run watch' }),
      finish('tool_10', false, { interrupted: true }),
    ],
    rows: [
      row('tool_9', 'command', 'Running command', 'running', { detail: 'sleep 60' }),
      row('tool_10', 'command', 'Running command', 'running', { detail: 'npm run watch' }),
      row('tool_10', 'command', 'Running command', 'interrupted', { detail: 'npm run watch' }),
    ],
  },
  {
    name: 'untyped tools and unknown result arms still show',
    events: [
      cursorCall('started', 'tool_11', {
        function: { name: 'custom_tool', arguments: '{"query":"PRIVATE_ARG"}' },
      }),
      cursorCall('started', 'tool_12', { readToolCall: { args: { path: missingPath } } }),
      cursorCall('completed', 'tool_12', {
        readToolCall: { result: { fileNotFound: { path: missingPath } } },
      }),
    ],
    parsed: [
      start('tool_11', 'other'),
      start('tool_12', 'read', { detail: 'missing.md' }),
      finish('tool_12', true, { failure: 'unclassified' }),
    ],
    rows: [
      row('tool_11', 'other', 'Using tool', 'running'),
      row('tool_12', 'read', 'Reading file', 'running', { detail: 'missing.md' }),
      row('tool_12', 'read', "Couldn't read file", 'failed', {
        detail: 'missing.md',
        error: 'The tool failed for an unrecognized reason.',
        failure: { reason: 'unclassified' },
      }),
    ],
  },
];

const gooseMessage = (role: 'assistant' | 'user', content: Event[]) => ({
  type: 'message',
  message: { id: `message-${role}`, role, created: 1763373600, content },
});
const toolRequest = (id: string, name: string, args: Event = {}) => ({
  type: 'toolRequest',
  id,
  toolCall: { status: 'success', value: { name, arguments: args } },
});
const toolResponse = (id: string, toolResult: Event) => ({ type: 'toolResponse', id, toolResult });
const toolResult = (text: string, isError = false) => ({
  status: 'success',
  value: { content: [{ type: 'text', text }], isError },
});
/** Goose 1.59's errors for arguments it could not parse. Both quote what the model sent. */
const notAnObject =
  '-32602: Tool arguments for pitchcrew__pitchcrew_computer_request (id call_6) must be a JSON object, got an array. Raw arguments: \'[{"text":"PRIVATE_ARG"}]\'';
const cutOff =
  '-32602: The model produced malformed tool arguments. Try resending your message or breaking the task into smaller steps.\nReceived 31 characters; cut off at: …"text":"PRIVATE_ARG';
const unparsedRequest = (id: string, error: string) => ({
  type: 'toolRequest',
  id,
  toolCall: { status: 'error', error },
  _meta: { 'goose.toolCall.providerIndex': 0 },
});
/** Goose answers such a call itself, repeating its error to the model. */
const unparsedAnswer = (id: string, error: string) =>
  toolResponse(id, {
    status: 'success',
    value: {
      resultType: 'complete',
      content: [
        {
          type: 'text',
          text: `The tool call could not be parsed: -32603: ${error}. Correct the arguments and try again.`,
        },
      ],
      isError: true,
    },
  });
const unparsedRows = (id: string) => [
  row(id, 'other', 'Using tool', 'running'),
  row(id, 'other', 'Tool failed', 'failed', {
    error: 'The tool rejected the arguments it was given.',
    failure: { reason: 'invalid_input' },
  }),
];

const gooseCases: Case[] = [
  {
    name: 'an unknown tool fails with its readable reason',
    events: [
      gooseMessage('assistant', [toolRequest('call_1', 'shell', { command: 'ls' })]),
      gooseMessage('user', [
        toolResponse('call_1', {
          status: 'error',
          error: "-32002: Tool 'shell' not found. Available tools: [pitchcrew__pitchcrew_get_card]",
        }),
      ]),
    ],
    parsed: [
      start('call_1', 'command', { detail: 'ls' }),
      finish('call_1', true, {
        reason: "Tool 'shell' not found.",
        failure: 'not_found',
        preGateway: true,
      }),
    ],
    rows: [
      row('call_1', 'command', 'Running command', 'running', { detail: 'ls' }),
      row('call_1', 'command', 'Command failed', 'failed', {
        detail: 'ls',
        error: "Tool 'shell' not found.",
        failure: { reason: 'not_found' },
      }),
    ],
  },
  {
    name: 'Pitchcrew and connector calls the daemon answered are left to the gateway',
    events: [
      gooseMessage('assistant', [
        toolRequest('call_2', 'pitchcrew__pitchcrew_get_card', { cardId: 'PRIVATE_ARG' }),
        toolRequest('call_3', 'pitchcrew__github_read_file', { path: 'PRIVATE_ARG' }),
      ]),
      gooseMessage('user', [
        toolResponse('call_2', toolResult('Card PRIVATE_ARG was not found.', true)),
        toolResponse('call_3', toolResult('PRIVATE_ARG')),
      ]),
    ],
    parsed: [
      start('call_2', 'mcp', { pitchcrew: 'pitchcrew_get_card' }),
      start('call_3', 'mcp', { pitchcrew: 'github_read_file' }),
      finish('call_2', true, { reason: 'Card PRIVATE_ARG was not found.' }),
      finish('call_3', false),
    ],
    rows: [],
  },
  {
    name: 'a Pitchcrew call Goose could not deliver shows once',
    events: [
      gooseMessage('assistant', [
        toolRequest('call_4', 'pitchcrew__gmail_search_messages', { query: 'PRIVATE_ARG' }),
      ]),
      gooseMessage('user', [
        toolResponse('call_4', { status: 'error', error: '-32603: Request timed out' }),
      ]),
    ],
    parsed: [
      start('call_4', 'mcp', { pitchcrew: 'gmail_search_messages' }),
      finish('call_4', true, { reason: 'Request timed out', preGateway: true }),
    ],
    rows: [
      row('call_4', 'mcp', "Couldn't read connected sources", 'failed', {
        error: 'Request timed out',
        failure: { reason: 'timeout', tool: 'gmail_search_messages' },
      }),
    ],
  },
  {
    name: 'a Pitchcrew call the MCP server rejected shows once',
    events: [
      gooseMessage('assistant', [toolRequest('call_5', 'pitchcrew__pitchcrew_get_card')]),
      gooseMessage('user', [toolResponse('call_5', toolResult(validationError, true))]),
    ],
    parsed: [
      start('call_5', 'mcp', { pitchcrew: 'pitchcrew_get_card' }),
      finish('call_5', true, { reason: validationError }),
    ],
    rows: [row('call_5', 'read', "Couldn't read job details", 'failed', rejectedCard)],
  },
  {
    name: 'a call whose arguments are not an object fails at once without the raw arguments',
    events: [
      gooseMessage('assistant', [unparsedRequest('call_6', notAnObject)]),
      gooseMessage('user', [unparsedAnswer('call_6', notAnObject)]),
    ],
    parsed: [start('call_6', 'other'), finish('call_6', true, { failure: 'invalid_input' })],
    rows: unparsedRows('call_6'),
  },
  {
    name: 'a call cut off mid-argument fails at once without the quoted tail',
    events: [
      gooseMessage('assistant', [unparsedRequest('call_8', cutOff)]),
      gooseMessage('user', [unparsedAnswer('call_8', cutOff)]),
    ],
    parsed: [start('call_8', 'other'), finish('call_8', true, { failure: 'invalid_input' })],
    rows: unparsedRows('call_8'),
  },
  {
    name: "another extension's tool shows only its names",
    events: [
      gooseMessage('assistant', [toolRequest('call_7', 'notes__lookup', { query: 'PRIVATE_ARG' })]),
      gooseMessage('user', [toolResponse('call_7', toolResult('PRIVATE_ARG'))]),
    ],
    parsed: [start('call_7', 'mcp', { detail: 'lookup (notes)' }), finish('call_7', false)],
    rows: [
      row('call_7', 'mcp', 'Calling tool', 'running', { detail: 'lookup (notes)' }),
      row('call_7', 'mcp', 'Called tool', 'completed', { detail: 'lookup (notes)' }),
    ],
  },
];

const runtimes: [RuntimeId, NativeToolParser, Case[]][] = [
  ['gemini-cli', geminiCliTools, geminiCases],
  ['copilot-cli', copilotCliTools, copilotCases],
  ['cursor-agent', cursorAgentTools, cursorCases],
  ['goose', gooseTools, gooseCases],
];

describe.each(runtimes)('%s native tool calls', (runtime, parser, cases) => {
  it.each(cases)('$name', ({ events, parsed, rows }) => {
    expect(parse(parser, events)).toEqual(parsed);
    const shown = steps(runtime, events);
    expect(shown).toEqual(rows);
    expect(JSON.stringify(shown)).not.toContain('PRIVATE_ARG');
  });
});

it("never passes on the arguments and results embedded in Gemini's mcp_tool_error", () => {
  const events = geminiCases.flatMap((test) => test.events);
  const embedding = events.filter((event) =>
    JSON.stringify(event.error ?? {}).includes('PRIVATE_ARG'),
  );
  expect(embedding).toHaveLength(4);
  expect(JSON.stringify(parse(geminiCliTools, events))).not.toContain('PRIVATE_ARG');
});

it("removes the runtime's secret values from a step's detail", () => {
  const command = 'curl -H "X-Run: fictional-run-token-1234" https://jobs.example.com';
  const events = [copilotStart('toolu_20', 'bash', { command })];
  expect(steps('copilot-cli', events, ['fictional-run-token-1234'])).toEqual([
    row('toolu_20', 'command', 'Running command', 'running', {
      detail: 'curl -H "X-Run: [redacted]" https://jobs.example.com',
    }),
  ]);
});

const malformed: [string, NativeToolParser, Event[]][] = [
  [
    'gemini-cli',
    geminiCliTools,
    [
      { type: 'tool_use' },
      { type: 'tool_use', tool_id: 'x' },
      { type: 'tool_use', tool_id: 5, tool_name: 'read_file' },
      { type: 'tool_use', tool_id: 'x', tool_name: ['read_file'] },
      { type: 'tool_result', tool_id: 'x', status: 'pending' },
      { type: 'tool_result', tool_id: null, status: 'error' },
      { type: 'message', role: 'assistant', content: 'Hello' },
    ],
  ],
  [
    'copilot-cli',
    copilotCliTools,
    [
      { type: 'tool.execution_start', data: null },
      { type: 'tool.execution_start', data: { toolCallId: 'x' } },
      { type: 'tool.execution_start', data: [{ toolCallId: 'x', toolName: 'bash' }] },
      { type: 'tool.execution_complete', data: { toolCallId: 'x' } },
      { type: 'tool.execution_complete', data: 'x' },
      { type: 'assistant.message', data: { toolRequests: 'bash' } },
      { type: 'assistant.message', data: { toolRequests: [null, 5, { toolCallId: 7 }] } },
      { type: 'result', exitCode: 0 },
    ],
  ],
  [
    'cursor-agent',
    cursorAgentTools,
    [
      { type: 'tool_call', subtype: 'started' },
      { type: 'tool_call', subtype: 'started', call_id: 'x', tool_call: null },
      { type: 'tool_call', subtype: 'started', call_id: 'x', tool_call: { mcpToolCall: {} } },
      { type: 'tool_call', subtype: 'completed', call_id: 'x', tool_call: { shellToolCall: {} } },
      cursorCall('completed', 'x', { shellToolCall: { result: 'done' } }),
      { type: 'thinking', subtype: 'delta', text: 'PRIVATE_ARG' },
    ],
  ],
  [
    'goose',
    gooseTools,
    [
      { type: 'message', message: null },
      { type: 'message', message: { content: 'text' } },
      { type: 'message', message: { content: [null, 5, 'x', { type: 'toolRequest' }] } },
      gooseMessage('assistant', [{ type: 'toolRequest', id: 'x', toolCall: { value: {} } }]),
      gooseMessage('user', [{ type: 'toolResponse', id: 'x', toolResult: { status: 'pending' } }]),
      { type: 'notification', extension_id: 'pitchcrew', log: { message: 'PRIVATE_ARG' } },
    ],
  ],
];

it.each(malformed)('%s ignores malformed events without throwing', (_, parser, events) => {
  const read = parser({ cwd });
  for (const event of events) expect(read(event)).toEqual([]);
});
