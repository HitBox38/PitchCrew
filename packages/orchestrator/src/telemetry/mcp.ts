import { mcpGatewayTools, mcpConnectorTools, sanitizeMcpToolCall } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import type { CrewContext } from '../crew/types.ts';

// Weak keys are the local capability objects, not their run/card/role identifiers.
const sessions = new WeakMap<object, string>();

export function beginMcpToolCall(
  context: CrewContext,
  token: string,
  action: string,
  data: Record<string, unknown>,
) {
  const capability = context.capabilities.get(token);
  const name =
    action === 'connector'
      ? typeof data.tool === 'string' && mcpConnectorTools.includes(data.tool)
        ? data.tool
        : undefined
      : Object.hasOwn(mcpGatewayTools, action)
        ? mcpGatewayTools[action as keyof typeof mcpGatewayTools]
        : undefined;
  if (!context.diagnostics || !capability || !name) return () => {};
  let session = sessions.get(capability);
  if (!session) {
    session = randomUUID();
    sessions.set(capability, session);
  }
  const start = performance.now();
  let finished = false;
  return (isError = false) => {
    if (finished) return;
    finished = true;
    try {
      const properties = sanitizeMcpToolCall({
        $mcp_tool_name: name,
        $mcp_is_error: isError,
        $mcp_duration_ms: Math.max(0, performance.now() - start),
        $mcp_session_id: session,
      });
      if (!properties) return;
      context.diagnostics?.record('$mcp_tool_call', properties);
    } catch {
      // Observation failures must never alter tool behavior or approvals.
    }
  };
}
