import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCrewContext } from '../../crew/context.ts';
import type { CrewContext, RunCapability } from '../../crew/types.ts';
import { beginMcpToolCall } from '../mcp.ts';
import { defaultCapabilities, sanitizeMcpToolCall } from '@pitchcrew/core';

const resources: { context: CrewContext; directory: string }[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const { context, directory } of resources.splice(0)) {
    context.controllers.clear();
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-mcp-telemetry-'));
  const record = vi.fn();
  const context = createCrewContext(directory, 'http://127.0.0.1:4417', '', true, undefined, {
    record,
  });
  resources.push({ context, directory });
  context.board.seedRoles('demo', true);
  const capability: RunCapability = { runId: 'private-run-id', cardId: null, roleId: 'scout' };
  context.capabilities.set('private-token', capability);
  context.controllers.set(capability.runId, new AbortController());
  return { context, record, capability };
}

describe('MCP gateway observations', () => {
  it('measures actual calls, returns original results and never captures supplied private content', async () => {
    const { context, record } = await fixture();
    const result = await context.agentCall('private-token', 'roles', {
      prompt: 'private-profile /Users/private https://secret.test',
    });
    expect(result.roles).toHaveLength(8);
    expect(record).toHaveBeenCalledTimes(1);
    const [event, properties] = record.mock.calls[0];
    expect(event).toBe('$mcp_tool_call');
    expect(properties).toMatchObject({
      $mcp_tool_name: 'pitchcrew_list_roles',
      $mcp_is_error: false,
      $mcp_server_name: 'pitchcrew',
      mcp_observation_level: 'scoped_gateway',
    });
    expect(properties.$mcp_duration_ms).toBeGreaterThanOrEqual(0);
    expect(properties.$mcp_session_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(properties.$session_id).toBe(properties.$mcp_session_id);
    expect(JSON.stringify(record.mock.calls)).not.toMatch(
      /private|Scout|description|model|runtime/,
    );
    await context.agentCall('private-token', 'roles', {});
    expect(record.mock.calls[1][1].$mcp_session_id).toBe(properties.$mcp_session_id);
    context.capabilities.set('private-token', { ...context.capabilities.get('private-token')! });
    await context.agentCall('private-token', 'roles', {});
    expect(record.mock.calls[2][1].$mcp_session_id).not.toBe(properties.$mcp_session_id);
  });

  it('preserves capability denial and records failure without error text or connector input', async () => {
    const { context, record } = await fixture();
    const call = vi.spyOn(context.connectors, 'call');
    await expect(
      context.agentCall('private-token', 'connector', {
        tool: 'github_read_file',
        input: { path: '/Users/private/file', revision: 'secret' },
      }),
    ).rejects.toThrow(
      'This connector capability is disabled for your role. Enable it in Your crew.',
    );
    expect(call).not.toHaveBeenCalled();
    expect(record.mock.calls[0][1]).toMatchObject({
      $mcp_tool_name: 'github_read_file',
      $mcp_is_error: true,
    });
    expect(JSON.stringify(record.mock.calls)).not.toMatch(/private|capability is disabled|secret/);
  });

  it('preserves validation rejection and cannot grant export approval', async () => {
    const { context, record, capability } = await fixture();
    capability.cardId = 'private-card-id';
    await expect(context.agentCall('private-token', 'history', { limit: 0 })).rejects.toThrow();
    expect(record.mock.calls[0][1].$mcp_is_error).toBe(true);
    capability.cardId = null;
    const exportPacket = vi.spyOn(context, 'exportPacket');
    await expect(
      context.agentCall('private-token', 'export', { approvalId: 'private-id' }),
    ).rejects.toThrow('This chat has no attached application.');
    expect(exportPacket).not.toHaveBeenCalled();
    expect(record.mock.calls[1][1].$mcp_is_error).toBe(true);
  });

  it('drops unauthenticated, unknown and bootstrap observations', async () => {
    const { context, record } = await fixture();
    await expect(context.agentCall('unknown-token', 'roles', {})).rejects.toThrow(
      'Run capability is invalid or expired.',
    );
    await expect(context.agentCall('private-token', 'private-unknown-action', {})).rejects.toThrow(
      'This tool is not allowed.',
    );
    await context.agentCall('private-token', 'computer_access', {});
    await context.agentCall('private-token', 'connector_access', {});
    await expect(
      context.agentCall('private-token', 'connector', { tool: 'private-name' }),
    ).rejects.toThrow();
    expect(record).not.toHaveBeenCalled();
  });

  it('preserves exact rejected error and result when the telemetry sink fails', async () => {
    const { context, record } = await fixture();
    record.mockImplementation(() => {
      throw new Error('telemetry unavailable');
    });
    // A successful ordinary tool remains available even when observation fails.
    expect((await context.agentCall('private-token', 'roles', {})).roles).toHaveLength(8);
    const error = new Error('private original error');
    vi.spyOn(context.board, 'list').mockImplementation(() => {
      throw error;
    });
    await expect(context.agentCall('private-token', 'roles', {})).rejects.toBe(error);
  });

  it('still dispatches when observation initialization fails', async () => {
    const { context, record } = await fixture();
    vi.spyOn(performance, 'now').mockImplementationOnce(() => {
      throw new Error('clock unavailable');
    });
    expect((await context.agentCall('private-token', 'roles', {})).roles).toHaveLength(8);
    expect(record).not.toHaveBeenCalled();
  });

  it('preserves tool success when elapsed time cannot be observed', async () => {
    const { context, record } = await fixture();
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockImplementationOnce(() => {
        throw new Error('clock unavailable');
      });
    expect((await context.agentCall('private-token', 'roles', {})).roles).toHaveLength(8);
    expect(record).not.toHaveBeenCalled();
  });

  it('returns the exact connector object while excluding its private results', async () => {
    const { context, record } = await fixture();
    const role = context.board.list<import('@pitchcrew/core').Role>('role')[0];
    context.board.record(
      'role',
      { ...role, capabilities: { ...defaultCapabilities, github: true } },
      'user',
      'Fixture permission',
    );
    const result = { contents: 'private-file-content', url: 'https://private.test' };
    vi.spyOn(context.connectors, 'call').mockResolvedValue(result);
    expect(
      await context.agentCall('private-token', 'connector', {
        tool: 'github_read_file',
        input: { path: 'private-path' },
      }),
    ).toBe(result);
    expect(record.mock.calls[0][1].$mcp_is_error).toBe(false);
    expect(JSON.stringify(record.mock.calls)).not.toContain('private');
  });

  it('records elapsed duration once, with no offline sink or arbitrary name observation', async () => {
    const { context, record } = await fixture();
    vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(450);
    const finish = beginMcpToolCall(context, 'private-token', 'roles', {});
    finish(false);
    finish(true);
    expect(record.mock.calls[0][1].$mcp_duration_ms).toBe(350);
    context.diagnostics = undefined;
    beginMcpToolCall(context, 'private-token', 'roles', {})(false);
    expect(record).toHaveBeenCalledTimes(1);
  });
});

describe('MCP property sanitizer', () => {
  const valid = {
    $mcp_tool_name: 'pitchcrew_list_roles',
    $mcp_is_error: false,
    $mcp_duration_ms: 13.4,
    $mcp_session_id: 'b3aa2328-dbf1-4618-a23b-45c695e9ab10',
  };
  it('rebuilds native properties and excludes raw SDK metadata and identities', () => {
    expect(
      sanitizeMcpToolCall({
        ...valid,
        $mcp_parameters: { profile: 'private' },
        $mcp_response: 'private',
        $mcp_error_message: 'private',
        $mcp_intent: 'private',
        $mcp_client_name: 'private',
        $mcp_llm_model: 'private',
        $mcp_server_name: 'private',
        $session_id: 'private-board-id',
      }),
    ).toEqual({
      ...valid,
      $mcp_duration_ms: 13,
      $mcp_server_name: 'pitchcrew',
      $session_id: valid.$mcp_session_id,
      mcp_observation_level: 'scoped_gateway',
    });
  });
  it.each([
    { $mcp_tool_name: '__proto__' },
    { $mcp_tool_name: 'private-tool' },
    { $mcp_is_error: 'false' },
    { $mcp_duration_ms: Infinity },
    { $mcp_duration_ms: NaN },
    { $mcp_duration_ms: -1 },
    { $mcp_duration_ms: 1_800_001 },
    { $mcp_session_id: 'private-run-id' },
  ])('rejects invalid native values %j', (change) => {
    expect(sanitizeMcpToolCall({ ...valid, ...change })).toBeNull();
  });
});
