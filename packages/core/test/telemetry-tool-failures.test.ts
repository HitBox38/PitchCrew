import { describe, expect, it } from 'vitest';
import { sanitizeMcpToolCall } from '../src/telemetry-mcp.ts';
import {
  sanitizeToolFailure,
  toolFailureFingerprint,
  toolFailureIssue,
} from '../src/telemetry-tool-failures.ts';
import { toolFailureDescriptions } from '../src/tool-failures.ts';

const session = 'b3aa2328-dbf1-4618-a23b-45c695e9ab10';
const gateway = {
  error_source: 'tool_call',
  error_category: 'internal',
  error_tool: 'pitchcrew_list_roles',
  error_boundary: 'gateway',
} as const;
const runtime = {
  error_source: 'runtime_tool',
  error_category: 'tool_error',
  error_tool_kind: 'command',
} as const;

describe('tool failure diagnostics', () => {
  it('rebuilds only closed fields, idempotently, and owns the session id', () => {
    const tool = sanitizeToolFailure({
      ...gateway,
      $mcp_session_id: session,
      $session_id: 'private-board-session',
      message: 'private /Users/person/file',
      $exception_list: [{ value: 'private' }],
      error_tool_kind: 'command',
    });
    expect(tool).toEqual({ ...gateway, $mcp_session_id: session, $session_id: session });
    expect(sanitizeToolFailure(tool!)).toEqual(tool);
    const native = sanitizeToolFailure({ ...runtime, error_tool: 'pitchcrew_list_roles' });
    expect(native).toEqual(runtime);
    expect(sanitizeToolFailure(native!)).toEqual(native);
    // A malformed session is dropped, never copied.
    expect(sanitizeToolFailure({ ...runtime, $mcp_session_id: 'private-run-id' })).toEqual(runtime);
    // Anything but the runtime boundary is the gateway's.
    expect(sanitizeToolFailure({ ...gateway, error_boundary: 'private' })).toEqual(gateway);
    expect(sanitizeToolFailure({ ...gateway, error_boundary: 'runtime' })).toEqual({
      ...gateway,
      error_boundary: 'runtime',
    });
  });

  it.each([
    { ...gateway, error_category: 'private' },
    { ...gateway, error_category: undefined },
    { ...gateway, error_tool: 'private_tool' },
    { ...gateway, error_tool: '__proto__' },
    { ...gateway, error_tool: undefined },
    { ...gateway, error_source: 'agent_report' },
    { ...runtime, error_tool_kind: 'shell' },
    { ...runtime, error_tool_kind: undefined },
    { ...gateway, error_category: 'declined' },
    { ...gateway, error_category: 'user_control' },
    { ...runtime, error_category: 'cancelled' },
  ])('rejects unknown vocabularies and the user’s own outcomes %j', (input) => {
    expect(sanitizeToolFailure(input)).toBeNull();
  });

  it('groups by tool or kind and reason, with repository-owned issue text', () => {
    const tool = sanitizeToolFailure({ ...gateway, $mcp_session_id: session })!;
    const native = sanitizeToolFailure(runtime)!;
    expect(toolFailureFingerprint(tool)).toBe(
      'pitchcrew-v1:tool_call:pitchcrew_list_roles:internal',
    );
    // The session never splits an issue.
    expect(toolFailureFingerprint(sanitizeToolFailure(gateway)!)).toBe(
      toolFailureFingerprint(tool),
    );
    expect(toolFailureFingerprint(native)).toBe('pitchcrew-v1:runtime_tool:command:tool_error');
    expect(toolFailureIssue(tool)).toEqual({
      name: 'Pitchcrew tool failed: pitchcrew_list_roles (internal)',
      description: toolFailureDescriptions.internal,
    });
    expect(toolFailureIssue(native)).toEqual({
      name: 'Agent runtime tool failed: command (tool_error)',
      description: toolFailureDescriptions.tool_error,
    });
  });
});

describe('MCP call failure type', () => {
  const call = {
    $mcp_tool_name: 'pitchcrew_list_roles',
    $mcp_is_error: true,
    $mcp_duration_ms: 12,
    $mcp_session_id: session,
  };
  it('keeps a closed failure type only on failed calls', () => {
    expect(sanitizeMcpToolCall({ ...call, $mcp_error_type: 'timeout' })).toMatchObject({
      $mcp_error_type: 'timeout',
    });
    // The user's own outcomes are still failed calls, named as such.
    expect(sanitizeMcpToolCall({ ...call, $mcp_error_type: 'declined' })).toMatchObject({
      $mcp_error_type: 'declined',
    });
    for (const change of [
      { $mcp_error_type: 'private error text' },
      { $mcp_error_type: 7 },
      { $mcp_is_error: false, $mcp_error_type: 'timeout' },
    ])
      expect(sanitizeMcpToolCall({ ...call, ...change })).not.toHaveProperty('$mcp_error_type');
  });
});
