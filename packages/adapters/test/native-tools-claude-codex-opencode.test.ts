import {
  crewToolLabelsFor,
  type ChatContext,
  type RunContext,
  type RuntimeActivity,
  type RuntimeId,
} from '@pitchcrew/core';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { NativeToolEvent, NativeToolParser } from '../src/activity/native-tools.ts';
import { nativeToolParsers } from '../src/activity/parsers.ts';
import { claudeCodeTools } from '../src/claude-code/tools.ts';
import { codexTools } from '../src/codex/tools.ts';
import { opencodeTools } from '../src/opencode/tools.ts';
import { runCliText } from '../src/process.ts';
import { chatEventStream } from '../src/streaming.ts';

// Fictional fixtures. PRIVATE_* markers sit in Pitchcrew arguments and results and in other
// payloads that must never become step text.
const cwd = join(tmpdir(), 'pitchcrew-native-fixture');
const at = (...parts: string[]) => join(cwd, ...parts);
const validation =
  'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_get_card: Invalid input: expected string, received number at cardId';
const missing = 'ls: missing-fixture: No such file or directory';
type Scenario = [name: string, events: Record<string, unknown>[], parsed: NativeToolEvent[]];

const claudeCall = (id: string, name: string, input: unknown, parent: string | null = null) => ({
  type: 'assistant',
  parent_tool_use_id: parent,
  message: {
    id: 'msg_fixture',
    role: 'assistant',
    content: [{ type: 'tool_use', id, name, input }],
  },
});
const claudeResult = (
  id: string,
  content: unknown,
  failed = false,
  parent: string | null = null,
) => ({
  type: 'user',
  parent_tool_use_id: parent,
  message: {
    role: 'user',
    content: [
      { type: 'tool_result', tool_use_id: id, content, ...(failed ? { is_error: true } : {}) },
    ],
  },
});
// Claude Code's call and answer, exactly as 2.1.317 to 2.1.326 send them, when it cannot parse a
// call's input as JSON: the answer quotes the input's first 200 bytes.
const unparsableCall = (id: string, name: string, raw: string) => {
  const shown = raw.slice(0, 200);
  return [
    claudeCall(id, name, { __unparsedToolInput: { raw, len: raw.length } }),
    claudeResult(
      id,
      `<tool_use_error>InputValidationError: ${name} was called with input that could not be parsed as JSON.\nYou sent (first ${shown.length} of ${raw.length} bytes): ${shown}\nCommon causes: unescaped backslashes in file paths (use / or \\\\), unescaped control characters, or truncated output. Retry with valid JSON.</tool_use_error>`,
      true,
    ),
  ];
};
const unparsed = (tool: string) =>
  `InputValidationError: mcp__pitchcrew__${tool} was called with input that could not be parsed as JSON.`;
const claude: Scenario[] = [
  [
    'a failed command, by its exit code and last line',
    [
      claudeCall('toolu_bash', 'Bash', { command: 'ls missing-fixture', description: 'List' }),
      claudeResult('toolu_bash', `Exit code 1\n${missing}`, true),
    ],
    [
      { phase: 'start', callId: 'toolu_bash', kind: 'command', detail: 'ls missing-fixture' },
      {
        phase: 'finish',
        callId: 'toolu_bash',
        failed: true,
        reason: `Exit code 1: ${missing}`,
        failure: 'tool_error',
      },
    ],
  ],
  [
    'a file read relative to the run folder',
    [
      claudeCall('toolu_read', 'Read', { file_path: at('notes', 'job.md') }),
      claudeResult('toolu_read', [{ type: 'text', text: 'PRIVATE_RESULT' }]),
    ],
    [
      { phase: 'start', callId: 'toolu_read', kind: 'read', detail: join('notes', 'job.md') },
      { phase: 'finish', callId: 'toolu_read', failed: false },
    ],
  ],
  [
    'a tool error without its wrapper tags',
    [
      claudeCall('toolu_missing', 'Read', { file_path: at('missing.md') }),
      claudeResult('toolu_missing', '<tool_use_error>File does not exist.</tool_use_error>', true),
    ],
    [
      { phase: 'start', callId: 'toolu_missing', kind: 'read', detail: 'missing.md' },
      { phase: 'finish', callId: 'toolu_missing', failed: true, reason: 'File does not exist.' },
    ],
  ],
  [
    'a Pitchcrew call, by its name only',
    [
      claudeCall('toolu_card', 'mcp__pitchcrew__pitchcrew_get_card', { cardId: 'PRIVATE_ARG' }),
      claudeResult('toolu_card', [
        { type: 'text', text: 'PRIVATE_RESULT' },
        { type: 'image', source: { data: 'PRIVATE_IMAGE' } },
      ]),
    ],
    [
      { phase: 'start', callId: 'toolu_card', kind: 'mcp', pitchcrew: 'pitchcrew_get_card' },
      { phase: 'finish', callId: 'toolu_card', failed: false },
    ],
  ],
  [
    'a Pitchcrew call the gateway refused',
    [
      claudeCall('toolu_export', 'mcp__pitchcrew__pitchcrew_export_packet', {
        note: 'PRIVATE_ARG',
      }),
      claudeResult(
        'toolu_export',
        [{ type: 'text', text: 'This role cannot export packets.' }],
        true,
      ),
    ],
    [
      { phase: 'start', callId: 'toolu_export', kind: 'mcp', pitchcrew: 'pitchcrew_export_packet' },
      {
        phase: 'finish',
        callId: 'toolu_export',
        failed: true,
        reason: 'This role cannot export packets.',
        preGateway: false,
      },
    ],
  ],
  [
    'a Pitchcrew call the MCP server rejected',
    [
      claudeCall('toolu_invalid', 'mcp__pitchcrew__pitchcrew_get_card', { cardId: 42 }),
      claudeResult('toolu_invalid', [{ type: 'text', text: validation }], true),
    ],
    [
      { phase: 'start', callId: 'toolu_invalid', kind: 'mcp', pitchcrew: 'pitchcrew_get_card' },
      {
        phase: 'finish',
        callId: 'toolu_invalid',
        failed: true,
        reason: validation,
        preGateway: true,
      },
    ],
  ],
  [
    'a Pitchcrew call Claude Code refused',
    [
      claudeCall('toolu_memory', 'mcp__pitchcrew__pitchcrew_save_memory', { text: 'PRIVATE_ARG' }),
      claudeResult(
        'toolu_memory',
        "Claude requested permissions to use mcp__pitchcrew__pitchcrew_save_memory, but you haven't granted it yet.",
        true,
      ),
    ],
    [
      { phase: 'start', callId: 'toolu_memory', kind: 'mcp', pitchcrew: 'pitchcrew_save_memory' },
      {
        phase: 'finish',
        callId: 'toolu_memory',
        failed: true,
        reason:
          "Claude requested permissions to use mcp__pitchcrew__pitchcrew_save_memory, but you haven't granted it yet.",
        preGateway: true,
      },
    ],
  ],
  [
    'Pitchcrew calls whose input Claude Code could not parse, without the input it quotes',
    [
      ...unparsableCall(
        'toolu_fill',
        'mcp__pitchcrew__pitchcrew_computer_request',
        '{"input":{"kind":"fill","selector":"ref:e14","value":"PRIVATE_ARG 123-45-6789\nsecond line',
      ),
      // Words that would otherwise choose a reason, and the answer's own phrases, inside the input.
      ...unparsableCall(
        'toolu_note',
        'mcp__pitchcrew__pitchcrew_save_memory',
        `{"text":"PRIVATE_ARG timed out, permission denied. Common causes: PRIVATE_ARG You sent (first 1 of 1 bytes): PRIVATE_ARG ${'x'.repeat(300)}`,
      ),
    ],
    [
      {
        phase: 'start',
        callId: 'toolu_fill',
        kind: 'mcp',
        pitchcrew: 'pitchcrew_computer_request',
      },
      {
        phase: 'finish',
        callId: 'toolu_fill',
        failed: true,
        reason: unparsed('pitchcrew_computer_request'),
        failure: 'invalid_input',
        preGateway: true,
      },
      { phase: 'start', callId: 'toolu_note', kind: 'mcp', pitchcrew: 'pitchcrew_save_memory' },
      {
        phase: 'finish',
        callId: 'toolu_note',
        failed: true,
        reason: unparsed('pitchcrew_save_memory'),
        failure: 'invalid_input',
        preGateway: true,
      },
    ],
  ],
  [
    'a call still open when the permission settings denied it',
    [
      claudeCall('toolu_fetch', 'WebFetch', { url: 'https://example.com/jobs/1?ref=PRIVATE_ARG' }),
      {
        type: 'result',
        subtype: 'success',
        result: '{"reply":"Done."}',
        permission_denials: [
          { tool_name: 'WebFetch', tool_use_id: 'toolu_fetch', tool_input: { url: 'PRIVATE_ARG' } },
          { tool_name: 'Bash', tool_use_id: 'toolu_bash', tool_input: { command: 'PRIVATE_ARG' } },
        ],
      },
    ],
    [
      {
        phase: 'start',
        callId: 'toolu_fetch',
        kind: 'fetch',
        detail: 'https://example.com/jobs/1',
      },
      {
        phase: 'finish',
        callId: 'toolu_fetch',
        failed: true,
        failure: 'not_allowed',
        preGateway: true,
      },
    ],
  ],
  [
    'other servers, plans, searches, subagents and unknown tools',
    [
      claudeCall('toolu_docs', 'mcp__docs__search', { query: 'PRIVATE_ARG' }),
      claudeCall('toolu_end', 'EndConversation', {}),
      claudeCall('toolu_plan', 'TodoWrite', {
        todos: [
          { content: 'Read the job', status: 'completed' },
          { content: 'Draft', status: 'in_progress' },
        ],
      }),
      claudeCall('toolu_grep', 'Grep', { pattern: 'TODO', path: at('src') }),
      claudeCall('toolu_agent', 'Agent', {
        description: 'Check the posting',
        prompt: 'PRIVATE_ARG',
      }),
    ],
    [
      { phase: 'start', callId: 'toolu_docs', kind: 'mcp', detail: 'search (docs)' },
      { phase: 'start', callId: 'toolu_end', kind: 'other', detail: 'EndConversation' },
      { phase: 'start', callId: 'toolu_plan', kind: 'todo', detail: '1/2 done' },
      { phase: 'start', callId: 'toolu_grep', kind: 'search', detail: 'TODO in src' },
      { phase: 'start', callId: 'toolu_agent', kind: 'agent', detail: 'Check the posting' },
    ],
  ],
  [
    "a subagent's own calls",
    [
      claudeCall('toolu_child', 'Read', { file_path: at('a.md') }, 'toolu_parent'),
      claudeResult('toolu_child', 'PRIVATE_RESULT', true, 'toolu_parent'),
    ],
    [],
  ],
  [
    'a tool_use sent again after its result',
    [
      claudeCall('toolu_once', 'Read', { file_path: at('a.md') }),
      claudeResult('toolu_once', 'PRIVATE_RESULT'),
      claudeCall('toolu_once', 'Read', { file_path: at('a.md') }),
    ],
    [
      { phase: 'start', callId: 'toolu_once', kind: 'read', detail: 'a.md' },
      { phase: 'finish', callId: 'toolu_once', failed: false },
    ],
  ],
  [
    'malformed and partial events',
    [
      { type: 'assistant', message: { content: 'not blocks' } },
      { type: 'assistant', message: { content: [{ type: 'tool_use' }, null, 'text'] } },
      claudeResult('never-started', 'PRIVATE_RESULT', true),
      { type: 'result', permission_denials: 'none' },
      {
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', id: 'toolu_partial', name: 'WebFetch', input: {} },
        },
      },
    ],
    [],
  ],
];

const item = (type: string, value: Record<string, unknown>) => ({ type, item: value });
const command = (id: string, line: string, end: Record<string, unknown> = {}) => ({
  id,
  type: 'command_execution',
  command: line,
  aggregated_output: '',
  exit_code: null,
  status: 'in_progress',
  ...end,
});
const mcpCall = (id: string, tool: string, end: Record<string, unknown>, server = 'pitchcrew') => ({
  id,
  type: 'mcp_tool_call',
  server,
  tool,
  arguments: { value: 'PRIVATE_ARG' },
  result: null,
  error: null,
  ...end,
});
const plan = (done: boolean) => ({
  id: 'item_9',
  type: 'todo_list',
  items: [
    { text: 'Read the job', completed: true },
    { text: 'Draft reply', completed: done },
  ],
});
const codex: Scenario[] = [
  [
    'a failed command, unwrapped from its shell',
    [
      item('item.started', command('item_1', "/bin/zsh -lc 'ls missing-fixture'")),
      item(
        'item.completed',
        command('item_1', "/bin/zsh -lc 'ls missing-fixture'", {
          aggregated_output: `${missing}\n`,
          exit_code: 1,
          status: 'failed',
        }),
      ),
    ],
    [
      { phase: 'start', callId: 'item_1', kind: 'command', detail: 'ls missing-fixture' },
      {
        phase: 'finish',
        callId: 'item_1',
        kind: 'command',
        detail: 'ls missing-fixture',
        failed: true,
        reason: `Exit code 1: ${missing}`,
        failure: 'tool_error',
      },
    ],
  ],
  [
    'a command the sandbox declined',
    [
      item('item.started', command('item_2', 'bash -lc "rm -rf build"')),
      item('item.completed', command('item_2', 'bash -lc "rm -rf build"', { status: 'declined' })),
    ],
    [
      { phase: 'start', callId: 'item_2', kind: 'command', detail: 'rm -rf build' },
      {
        phase: 'finish',
        callId: 'item_2',
        kind: 'command',
        detail: 'rm -rf build',
        failed: true,
        reason: 'Declined by the sandbox or approval policy.',
        failure: 'not_allowed',
      },
    ],
  ],
  [
    'a command still running when the turn ended',
    [
      item('item.started', command('item_3', 'bash -lc sleep')),
      item('item.completed', command('item_3', 'bash -lc sleep')),
    ],
    [
      { phase: 'start', callId: 'item_3', kind: 'command', detail: 'sleep' },
      {
        phase: 'finish',
        callId: 'item_3',
        kind: 'command',
        detail: 'sleep',
        failed: false,
        interrupted: true,
      },
    ],
  ],
  [
    'a Pitchcrew call, by its name only',
    [
      item('item.started', mcpCall('item_4', 'pitchcrew_get_card', { status: 'in_progress' })),
      item(
        'item.completed',
        mcpCall('item_4', 'pitchcrew_get_card', {
          status: 'completed',
          result: { content: [{ type: 'text', text: 'PRIVATE_RESULT' }], structured_content: null },
        }),
      ),
    ],
    [
      { phase: 'start', callId: 'item_4', kind: 'mcp', pitchcrew: 'pitchcrew_get_card' },
      {
        phase: 'finish',
        callId: 'item_4',
        kind: 'mcp',
        pitchcrew: 'pitchcrew_get_card',
        failed: false,
      },
    ],
  ],
  [
    'Pitchcrew calls refused by the gateway, rejected by the MCP server or timed out',
    [
      item(
        'item.completed',
        mcpCall('item_5', 'pitchcrew_export_packet', {
          status: 'failed',
          result: { content: [{ type: 'text', text: 'This role cannot export packets.' }] },
        }),
      ),
      item(
        'item.completed',
        mcpCall('item_6', 'pitchcrew_get_card', {
          status: 'failed',
          result: { content: [{ type: 'text', text: validation }] },
        }),
      ),
      item(
        'item.completed',
        mcpCall('item_7', 'pitchcrew_scan_job_sources', {
          status: 'failed',
          error: { message: 'tool call timed out after 60s' },
        }),
      ),
    ],
    [
      {
        phase: 'finish',
        callId: 'item_5',
        kind: 'mcp',
        pitchcrew: 'pitchcrew_export_packet',
        failed: true,
        reason: 'This role cannot export packets.',
      },
      {
        phase: 'finish',
        callId: 'item_6',
        kind: 'mcp',
        pitchcrew: 'pitchcrew_get_card',
        failed: true,
        reason: validation,
      },
      {
        phase: 'finish',
        callId: 'item_7',
        kind: 'mcp',
        pitchcrew: 'pitchcrew_scan_job_sources',
        failed: true,
        reason: 'tool call timed out after 60s',
        preGateway: true,
      },
    ],
  ],
  [
    'a patch reported only once it failed',
    [
      item('item.completed', {
        id: 'item_8',
        type: 'file_change',
        changes: [
          { path: at('notes.md'), kind: 'update' },
          { path: at('cv.md'), kind: 'add' },
        ],
        status: 'failed',
      }),
    ],
    [
      {
        phase: 'finish',
        callId: 'item_8',
        kind: 'edit',
        detail: 'notes.md +1 more',
        failed: true,
        reason: 'The patch was not applied.',
      },
    ],
  ],
  [
    'a plan updated in place',
    [
      item('item.started', plan(false)),
      item('item.updated', plan(true)),
      item('item.completed', plan(true)),
    ],
    [
      { phase: 'finish', callId: 'item_9', kind: 'todo', detail: '1/2 done', failed: false },
      { phase: 'finish', callId: 'item_9', kind: 'todo', detail: '2/2 done', failed: false },
      { phase: 'finish', callId: 'item_9', kind: 'todo', detail: '2/2 done', failed: false },
    ],
  ],
  [
    "another MCP server's call, by name",
    [
      item('item.started', mcpCall('item_10', 'search', { status: 'in_progress' }, 'docs')),
      item('item.completed', mcpCall('item_10', 'search', { status: 'completed' }, 'docs')),
    ],
    [
      { phase: 'start', callId: 'item_10', kind: 'mcp', detail: 'search (docs)' },
      {
        phase: 'finish',
        callId: 'item_10',
        kind: 'mcp',
        detail: 'search (docs)',
        failed: false,
      },
    ],
  ],
  [
    'a web search whose query arrives when it completes',
    [
      item('item.started', { id: 'ws_fixture', type: 'web_search', query: '', action: {} }),
      item('item.completed', { id: 'ws_fixture', type: 'web_search', query: 'fixture jobs' }),
    ],
    [
      {
        phase: 'finish',
        callId: 'ws_fixture',
        kind: 'web_search',
        detail: 'fixture jobs',
        failed: false,
      },
    ],
  ],
  [
    'a subagent that errored, by its collab tool and never its prompt',
    [
      item('item.started', {
        id: 'item_14',
        type: 'collab_tool_call',
        tool: 'spawn_agent',
        prompt: 'PRIVATE_ARG Review the fixture posting',
        agents_states: {},
        status: 'in_progress',
      }),
      item('item.completed', {
        id: 'item_14',
        type: 'collab_tool_call',
        tool: 'spawn_agent',
        prompt: 'PRIVATE_ARG Review the fixture posting',
        agents_states: { thread_1: { status: 'errored', message: 'Fixture agent crashed' } },
        status: 'failed',
      }),
    ],
    [
      { phase: 'start', callId: 'item_14', kind: 'agent', detail: 'spawn_agent' },
      {
        phase: 'finish',
        callId: 'item_14',
        kind: 'agent',
        detail: 'spawn_agent',
        failed: true,
        reason: 'Fixture agent crashed',
      },
    ],
  ],
  [
    'a collab tool it does not know, without a detail',
    [
      item('item.completed', {
        id: 'item_16',
        type: 'collab_tool_call',
        tool: 'PRIVATE_TOOL',
        prompt: 'PRIVATE_ARG',
        agents_states: {},
        status: 'completed',
      }),
    ],
    [{ phase: 'finish', callId: 'item_16', kind: 'agent', failed: false }],
  ],
  [
    'messages, reasoning, warnings and malformed items',
    [
      item('item.completed', { id: 'item_11', type: 'reasoning', text: 'PRIVATE_REASONING' }),
      item('item.completed', { id: 'item_12', type: 'agent_message', text: 'Checking.' }),
      item('item.completed', { id: 'item_13', type: 'error', message: 'Fixture warning' }),
      { type: 'turn.failed', error: { message: 'Fixture failure' } },
      { type: 'item.started' },
      item('item.completed', { type: 'command_execution', command: 'ls' }),
      item('item.completed', { id: 'item_15', type: 'mcp_tool_call', status: 'failed' }),
      { type: 'item.completed', item: 'not an item' },
    ],
    [],
  ],
];

const opencodeCall = (callID: string, tool: string, state: Record<string, unknown>) => ({
  type: 'tool_use',
  timestamp: 1,
  sessionID: 'ses_fixture',
  part: {
    id: `prt_${callID}`,
    sessionID: 'ses_fixture',
    messageID: 'msg_fixture',
    type: 'tool',
    callID,
    tool,
    state: { time: { start: 1, end: 2 }, ...state },
  },
});
const done = (input: unknown, extra: Record<string, unknown> = {}) => ({
  status: 'completed',
  input,
  output: 'PRIVATE_RESULT',
  title: 'Fixture',
  metadata: {},
  ...extra,
});
const opencode: Scenario[] = [
  [
    'a failed fetch, without the query',
    [
      opencodeCall('call_fetch', 'webfetch', {
        status: 'error',
        input: { url: 'https://example.com/jobs/1?token=PRIVATE_ARG', format: 'markdown' },
        error: 'Fixture rule prevents this tool call.',
      }),
    ],
    [
      {
        phase: 'finish',
        callId: 'call_fetch',
        kind: 'fetch',
        detail: 'https://example.com/jobs/1',
        failed: true,
        reason: 'Fixture rule prevents this tool call.',
      },
    ],
  ],
  [
    'a command that exited non-zero',
    [
      opencodeCall(
        'call_bash',
        'bash',
        done({ command: 'ls missing-fixture' }, { output: `${missing}\n`, metadata: { exit: 1 } }),
      ),
    ],
    [
      {
        phase: 'finish',
        callId: 'call_bash',
        kind: 'command',
        detail: 'ls missing-fixture',
        failed: true,
        reason: `Exit code 1: ${missing}`,
        failure: 'tool_error',
      },
    ],
  ],
  [
    'a read and a plan',
    [
      opencodeCall('call_read', 'read', done({ filePath: at('notes', 'job.md') })),
      opencodeCall(
        'call_plan',
        'todowrite',
        done({
          todos: [
            { content: 'Read', status: 'completed', priority: 'high', id: '1' },
            { content: 'Draft', status: 'pending', priority: 'high', id: '2' },
          ],
        }),
      ),
    ],
    [
      {
        phase: 'finish',
        callId: 'call_read',
        kind: 'read',
        detail: join('notes', 'job.md'),
        failed: false,
      },
      { phase: 'finish', callId: 'call_plan', kind: 'todo', detail: '1/2 done', failed: false },
    ],
  ],
  [
    'Pitchcrew calls: done, refused by the gateway and rejected by the MCP server',
    [
      opencodeCall('call_mail', 'pitchcrew_gmail_search_messages', done({ query: 'PRIVATE_ARG' })),
      opencodeCall('call_export', 'pitchcrew_pitchcrew_export_packet', {
        status: 'error',
        input: { note: 'PRIVATE_ARG' },
        error: 'This role cannot export packets.',
      }),
      opencodeCall('call_card', 'pitchcrew_pitchcrew_get_card', {
        status: 'error',
        input: { cardId: 42 },
        error: validation,
      }),
    ],
    [
      {
        phase: 'finish',
        callId: 'call_mail',
        kind: 'mcp',
        pitchcrew: 'gmail_search_messages',
        failed: false,
      },
      {
        phase: 'finish',
        callId: 'call_export',
        kind: 'mcp',
        pitchcrew: 'pitchcrew_export_packet',
        failed: true,
        reason: 'This role cannot export packets.',
      },
      {
        phase: 'finish',
        callId: 'call_card',
        kind: 'mcp',
        pitchcrew: 'pitchcrew_get_card',
        failed: true,
        reason: validation,
      },
    ],
  ],
  [
    'calls rerouted to the invalid tool, without the arguments its error quotes',
    [
      opencodeCall(
        'call_browser',
        'invalid',
        done({
          tool: 'pitchcrew_pitchcrew_computer_request',
          error:
            'Invalid input for tool pitchcrew_pitchcrew_computer_request: Type validation failed: Value: {"value":"PRIVATE_ARG"}',
        }),
      ),
      opencodeCall(
        'call_shell',
        'invalid',
        done({
          tool: 'shell',
          error: "Model tried to call unavailable tool 'shell'. Available tools: bash.",
        }),
      ),
    ],
    [
      {
        phase: 'finish',
        callId: 'call_browser',
        pitchcrew: 'pitchcrew_computer_request',
        failed: true,
        preGateway: true,
        failure: 'invalid_input',
      },
      {
        phase: 'finish',
        callId: 'call_shell',
        kind: 'other',
        detail: 'shell',
        failed: true,
        failure: 'not_found',
        reason: 'No tool by that name is available.',
      },
    ],
  ],
  [
    "the next major version's part, which names the call id",
    [
      {
        type: 'tool_use',
        timestamp: 5,
        part: {
          partID: 'prt_dev',
          sessionID: 'ses_fixture',
          messageID: 'msg_fixture',
          type: 'tool',
          id: 'call_dev',
          tool: 'grep',
          state: done({ pattern: 'TODO', path: at('src') }, { output: '' }),
        },
      },
    ],
    [{ phase: 'finish', callId: 'call_dev', kind: 'search', detail: 'TODO in src', failed: false }],
  ],
  [
    'malformed, unfinished and run-level events',
    [
      { type: 'tool_use', part: { type: 'tool', output: 'Ignore me.' } },
      {
        type: 'tool_use',
        part: { type: 'tool', tool: 'bash', callID: 'call_running', state: { status: 'running' } },
      },
      { type: 'error', error: { name: 'APIError', data: { message: 'Fixture rate limit' } } },
      { type: 'text', part: { type: 'text', text: 'Checking.' } },
    ],
    [],
  ],
];

const runtimes: [RuntimeId, NativeToolParser, Scenario[]][] = [
  ['claude-code', claudeCodeTools, claude],
  ['codex', codexTools, codex],
  ['opencode', opencodeTools, opencode],
];

describe.each(runtimes)('%s native tool parser', (_runtime, parser, scenarios) => {
  it.each(scenarios)('normalizes %s', (_name, events, parsed) => {
    const parse = parser({ cwd });
    expect(events.flatMap((event) => parse(event))).toEqual(parsed);
  });
});

const chatTurn = (runtime: RuntimeId) => {
  const onActivity = vi.fn<(entry: RuntimeActivity) => void>();
  const context = {
    role: { runtime },
    directory: cwd,
    messages: [],
    signal: new AbortController().signal,
    onActivity,
  } as unknown as ChatContext;
  const rows = () =>
    onActivity.mock.calls.map(([entry]) => entry).filter((entry) => entry.kind === 'tool');
  return { context, onActivity, rows };
};
const line = (row: RuntimeActivity) =>
  [row.id, row.status, row.label, row.detail, row.error].filter(Boolean).join(' | ');
const crewFailed = (action: string) => crewToolLabelsFor(action).failed;

const expectedRows: Record<string, string[]> = {
  'claude-code': [
    'native-toolu_bash | running | Running command | ls missing-fixture',
    `native-toolu_bash | failed | Command failed | ls missing-fixture | Exit code 1: ${missing}`,
    `native-toolu_read | running | Reading file | ${join('notes', 'job.md')}`,
    `native-toolu_read | completed | Read file | ${join('notes', 'job.md')}`,
    'native-toolu_missing | running | Reading file | missing.md',
    "native-toolu_missing | failed | Couldn't read file | missing.md | File does not exist.",
    `native-toolu_invalid | failed | ${crewFailed('card')} | ${validation}`,
    `native-toolu_memory | failed | ${crewFailed('save_memory')} | Claude requested permissions to use mcp__pitchcrew__pitchcrew_save_memory, but you haven't granted it yet.`,
    // A browser call shows only its reason's sentence; another Pitchcrew call, Claude's own.
    `native-toolu_fill | failed | ${crewFailed('computer_request')} | The tool rejected the arguments it was given.`,
    `native-toolu_note | failed | ${crewFailed('save_memory')} | ${unparsed('pitchcrew_save_memory')}`,
    'native-toolu_fetch | running | Fetching page | https://example.com/jobs/1',
    "native-toolu_fetch | failed | Couldn't fetch page | https://example.com/jobs/1 | This run is not allowed to use that tool or action.",
    'native-toolu_docs | running | Calling tool | search (docs)',
    'native-toolu_end | running | Using tool | EndConversation',
    'native-toolu_plan | running | Updating plan | 1/2 done',
    'native-toolu_grep | running | Searching files | TODO in src',
    'native-toolu_agent | running | Running subagent | Check the posting',
    'native-toolu_once | running | Reading file | a.md',
    'native-toolu_once | completed | Read file | a.md',
  ],
  codex: [
    'native-item_1 | running | Running command | ls missing-fixture',
    `native-item_1 | failed | Command failed | ls missing-fixture | Exit code 1: ${missing}`,
    'native-item_2 | running | Running command | rm -rf build',
    'native-item_2 | failed | Command failed | rm -rf build | Declined by the sandbox or approval policy.',
    'native-item_3 | running | Running command | sleep',
    'native-item_3 | interrupted | Running command | sleep',
    `native-item_6 | failed | ${crewFailed('card')} | ${validation}`,
    `native-item_7 | failed | ${crewFailed('scan_job_sources')} | tool call timed out after 60s`,
    "native-item_8 | failed | Couldn't edit file | notes.md +1 more | The patch was not applied.",
    'native-item_9 | completed | Updated plan | 1/2 done',
    'native-item_9 | completed | Updated plan | 2/2 done',
    'native-item_9 | completed | Updated plan | 2/2 done',
    'native-item_10 | running | Calling tool | search (docs)',
    'native-item_10 | completed | Called tool | search (docs)',
    'native-ws_fixture | completed | Searched the web | fixture jobs',
    'native-item_14 | running | Running subagent | spawn_agent',
    'native-item_14 | failed | Subagent failed | spawn_agent | Fixture agent crashed',
    'native-item_16 | completed | Ran subagent',
  ],
  opencode: [
    "native-call_fetch | failed | Couldn't fetch page | https://example.com/jobs/1 | Fixture rule prevents this tool call.",
    `native-call_bash | failed | Command failed | ls missing-fixture | Exit code 1: ${missing}`,
    `native-call_read | completed | Read file | ${join('notes', 'job.md')}`,
    'native-call_plan | completed | Updated plan | 1/2 done',
    `native-call_card | failed | ${crewFailed('card')} | ${validation}`,
    `native-call_browser | failed | ${crewFailed('computer_request')} | The tool rejected the arguments it was given.`,
    'native-call_shell | failed | Tool failed | shell | No tool by that name is available.',
    'native-call_dev | completed | Searched files | TODO in src',
  ],
};

describe.each(runtimes)('%s chat stream', (runtime, _parser, scenarios) => {
  it('shows native calls as steps and only Pitchcrew calls the gateway never saw', () => {
    const { context, onActivity, rows } = chatTurn(runtime);
    const stream = chatEventStream(context);
    for (const event of scenarios.flatMap(([, events]) => events)) stream.event(event);
    expect(rows().map(line)).toEqual(expectedRows[runtime]);
    // Pitchcrew arguments and results, tool output and images never become step text.
    expect(JSON.stringify(onActivity.mock.calls)).not.toMatch(/PRIVATE/);
    expect(rows().find((row) => row.failure?.tool)?.failure).toEqual({
      reason: 'invalid_input',
      tool: 'pitchcrew_get_card',
    });
  });
});

describe('which runs show native calls', () => {
  const runContext = (shape: Partial<RunContext>) => {
    const onActivity = vi.fn();
    const context = {
      role: { runtime: 'codex' },
      directory: cwd,
      signal: new AbortController().signal,
      onActivity,
      ...shape,
    } as unknown as RunContext;
    return { context, onActivity };
  };
  const started = item('item.started', command('item_1', 'bash -lc ls'));

  it('shows them in deep-review stages but never in plain workflow runs', () => {
    const review = runContext({
      deepReview: { id: 'fixture' } as unknown as RunContext['deepReview'],
    });
    chatEventStream(review.context).event(started);
    expect(review.onActivity).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'native-item_1', label: 'Running command', detail: 'ls' }),
    );
    const workflow = runContext({});
    chatEventStream(workflow.context).event(started);
    expect(workflow.onActivity).not.toHaveBeenCalled();
  });

  it('gives a workflow run only the closed words of a call that failed before the daemon', () => {
    const onToolFailure = vi.fn();
    const { context, onActivity } = runContext({
      role: { runtime: 'claude-code' } as RunContext['role'],
      onToolFailure,
    });
    const stream = chatEventStream(context);
    for (const event of [
      claudeCall('toolu_lint', 'mcp__pitchcrew__pitchcrew_lint_packet', { packet: 'PRIVATE_ARG' }),
      claudeResult(
        'toolu_lint',
        [
          {
            type: 'text',
            text: 'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_lint_packet: expected object, received string at packet',
          },
        ],
        true,
      ),
      // Running, successful and gateway-refused calls report nothing here.
      claudeCall('toolu_card', 'mcp__pitchcrew__pitchcrew_get_card', { cardId: 'PRIVATE_ARG' }),
      claudeResult('toolu_card', 'PRIVATE_RESULT'),
      claudeCall('toolu_export', 'mcp__pitchcrew__pitchcrew_export_packet', {
        note: 'PRIVATE_ARG',
      }),
      claudeResult('toolu_export', 'This role cannot export packets.', true),
      claudeCall('toolu_read', 'Read', { file_path: at('notes', 'job.md') }),
      claudeResult('toolu_read', 'PRIVATE_RESULT'),
      claudeCall('toolu_open', 'Read', { file_path: at('open.md') }),
    ])
      stream.event(event);
    stream.finish();
    expect(onActivity).not.toHaveBeenCalled();
    expect(onToolFailure.mock.calls).toEqual([
      [{ reason: 'invalid_input', tool: 'pitchcrew_lint_packet', kind: 'check' }],
    ]);
  });

  it('reads no tool events in a run that neither shows steps nor reports failures', () => {
    const original = nativeToolParsers.codex;
    const parse = vi.fn(() => []);
    nativeToolParsers.codex = () => parse;
    try {
      chatEventStream(runContext({}).context).event(started);
      expect(parse).not.toHaveBeenCalled();
      chatEventStream(runContext({ onToolFailure: vi.fn() }).context).event(started);
      expect(parse).toHaveBeenCalledOnce();
    } finally {
      nativeToolParsers.codex = original;
    }
  });

  it('stops after the turn is cancelled', () => {
    const controller = new AbortController();
    const { context, rows } = chatTurn('codex');
    const stream = chatEventStream({ ...context, signal: controller.signal });
    stream.event(started);
    controller.abort();
    stream.event(item('item.completed', command('item_1', 'bash -lc ls', { status: 'completed' })));
    expect(rows().map((row) => row.status)).toEqual(['running']);
  });
});

it('removes the run token from tool steps on the real spawn path', async () => {
  const token = 'fixture-run-token-0001';
  const onActivity = vi.fn<(entry: RuntimeActivity) => void>();
  const context: ChatContext = {
    card: null,
    role: {
      id: 'scout',
      name: 'Scout',
      description: 'Fixture',
      runtime: 'claude-code',
      model: '',
      enabled: true,
      instructions: 'Fixture',
    },
    profile: [],
    directory: process.cwd(),
    mcp: {
      command: process.execPath,
      args: [],
      env: { PITCHCREW_RUN_TOKEN: token, PITCHCREW_DAEMON_URL: 'http://127.0.0.1:1' },
    },
    signal: new AbortController().signal,
    onMessage: () => {},
    onActivity,
    messages: [],
  };
  const reply = await runCliText(
    process.execPath,
    [fileURLToPath(new URL('./fixtures/native-tools-cli.ts', import.meta.url))],
    context,
    'Fixture prompt',
    (event) => (event.type === 'result' && typeof event.result === 'string' ? event.result : null),
  );
  expect(reply).toBe('{"reply":"Done."}');
  expect(onActivity.mock.calls.map(([entry]) => entry)).toEqual([
    {
      id: 'native-toolu_fixture',
      kind: 'tool',
      tool: 'command',
      label: 'Running command',
      detail: 'echo [redacted]',
      status: 'running',
    },
    {
      id: 'native-toolu_fixture',
      kind: 'tool',
      tool: 'command',
      label: 'Command failed',
      detail: 'echo [redacted]',
      status: 'failed',
      error: 'Exit code 1: rejected [redacted]',
      failure: { reason: 'tool_error' },
    },
  ]);
  expect(JSON.stringify(onActivity.mock.calls)).not.toContain(token);
});
