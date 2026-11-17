import {
  mcpGatewayTools,
  mcpConnectorTools,
  sanitizeMcpToolCall,
  type ToolFailureReason,
} from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import type { CrewContext } from '../crew/types.ts';

// Weak keys are the local capability objects, not their run/card/role identifiers.
const sessions = new WeakMap<object, string>();

/** One telemetry-only session per run capability, shared by its tool calls and failures. */
export const mcpSessionId = (capability: object) => {
  let session = sessions.get(capability);
  if (!session) sessions.set(capability, (session = randomUUID()));
  return session;
};

/** The reviewed MCP tool behind a gateway call; bootstrap and unknown actions have none. */
export const reviewedToolName = (action: string, data: Record<string, unknown>) =>
  action === 'connector'
    ? typeof data.tool === 'string' && mcpConnectorTools.includes(data.tool)
      ? data.tool
      : undefined
    : Object.hasOwn(mcpGatewayTools, action)
      ? mcpGatewayTools[action as keyof typeof mcpGatewayTools]
      : undefined;

export const beginMcpToolCall = (
  context: CrewContext,
  token: string,
  action: string,
  data: Record<string, unknown>,
) => {
  const capability = context.capabilities.get(token);
  const name = reviewedToolName(action, data);
  if (!context.diagnostics || !capability || !name) return () => {};
  const session = mcpSessionId(capability);
  const start = performance.now();
  let finished = false;
  return (isError = false, reason?: ToolFailureReason) => {
    if (finished) return;
    finished = true;
    try {
      const properties = sanitizeMcpToolCall({
        $mcp_tool_name: name,
        $mcp_is_error: isError,
        $mcp_duration_ms: Math.max(0, performance.now() - start),
        $mcp_session_id: session,
        $mcp_error_type: reason,
      });
      if (!properties) return;
      context.diagnostics?.record('$mcp_tool_call', properties);
    } catch {
      // Observation failures must never alter tool behavior or approvals.
    }
  };
};
