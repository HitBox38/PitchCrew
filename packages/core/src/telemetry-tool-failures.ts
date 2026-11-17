import { isReviewedMcpTool } from './telemetry-mcp.ts';
import { isActivityToolKind } from './tool-activity.ts';
import {
  isToolFailureReason,
  reportableToolFailure,
  toolFailureDescriptions,
  type ToolFailureReason,
} from './tool-failures.ts';

/**
 * A failed tool call as a sanitized `$exception`: a reviewed Pitchcrew tool name (or, for a
 * runtime's own tool, only its kind) and a closed reason. Never message text, arguments, paths or
 * identifiers. Shared by the daemon buffer and the renderer relay; both rebuild, never spread.
 */
export type ToolFailureObservation =
  | {
      error_source: 'tool_call';
      error_category: ToolFailureReason;
      error_tool: string;
      /** Where the failure was observed: the daemon gateway, or the runtime before it. */
      error_boundary: 'gateway' | 'runtime';
      $mcp_session_id?: string;
      $session_id?: string;
    }
  | {
      error_source: 'runtime_tool';
      error_category: ToolFailureReason;
      error_tool_kind: string;
      $mcp_session_id?: string;
      $session_id?: string;
    };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const sanitizeToolFailure = (
  input: Record<string, unknown>,
): ToolFailureObservation | null => {
  const reason = input.error_category;
  if (!isToolFailureReason(reason) || !reportableToolFailure(reason)) return null;
  const session =
    typeof input.$mcp_session_id === 'string' && uuid.test(input.$mcp_session_id)
      ? { $mcp_session_id: input.$mcp_session_id, $session_id: input.$mcp_session_id }
      : {};
  if (input.error_source === 'tool_call' && isReviewedMcpTool(input.error_tool))
    return {
      error_source: 'tool_call',
      error_category: reason,
      error_tool: input.error_tool,
      error_boundary: input.error_boundary === 'runtime' ? 'runtime' : 'gateway',
      ...session,
    };
  if (input.error_source === 'runtime_tool' && isActivityToolKind(input.error_tool_kind))
    return {
      error_source: 'runtime_tool',
      error_category: reason,
      error_tool_kind: input.error_tool_kind,
      ...session,
    };
  return null;
};

/** One issue per tool (or runtime tool kind) and reason, wherever it was observed. */
export const toolFailureFingerprint = (failure: ToolFailureObservation) =>
  failure.error_source === 'tool_call'
    ? `pitchcrew-v1:tool_call:${failure.error_tool}:${failure.error_category}`
    : `pitchcrew-v1:runtime_tool:${failure.error_tool_kind}:${failure.error_category}`;

/** Repository-owned issue title and description; no observed text. */
export const toolFailureIssue = (failure: ToolFailureObservation) => ({
  name:
    failure.error_source === 'tool_call'
      ? `Pitchcrew tool failed: ${failure.error_tool} (${failure.error_category})`
      : `Agent runtime tool failed: ${failure.error_tool_kind} (${failure.error_category})`,
  description: toolFailureDescriptions[failure.error_category],
});
