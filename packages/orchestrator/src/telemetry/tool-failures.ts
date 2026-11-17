import { toolFaultReasons, type ToolFailureReason } from '@pitchcrew/core';
import {
  sanitizeToolFailure,
  toolFailureFingerprint,
  type ToolFailureObservation,
} from '@pitchcrew/core/telemetry-tool-failures';
import type { CrewContext, RunCapability } from '../crew/types.ts';
import { mcpSessionId, reviewedToolName } from './mcp.ts';

const perRun = 8;
const perMinute = 20;

// Weak keys end each limit with its run capability or daemon context.
const limits = () => ({
  reported: new WeakMap<RunCapability, Set<string>>(),
  recent: new WeakMap<CrewContext, number[]>(),
});
/** Faults keep their own limits, so routine refusals never use up the reports a fault needs. */
const faultLimits = limits();
const otherLimits = limits();

/**
 * A failed tool call as a sanitized `$exception`: closed words only, once per tool (or runtime
 * tool kind) and reason in a run. Faults (timeouts, outages, internal and unrecognized errors) are
 * limited to eight per run and twenty a minute, and the other reasons (refusals and tool errors)
 * separately to the same. Observations the renderer relays bypass its own rate limit, so the
 * daemon bounds them here. The user's own outcomes (declined, user control, cancelled) are never
 * reported.
 */
export const recordToolFailure = (
  context: CrewContext,
  capability: RunCapability,
  observation: ToolFailureObservation,
) => {
  try {
    if (!context.diagnostics) return;
    const properties = sanitizeToolFailure({
      ...observation,
      $mcp_session_id: mcpSessionId(capability),
    });
    if (!properties) return;
    // A fingerprint names its reason, so each one counts against exactly one group's limits.
    const { reported, recent } = toolFaultReasons.includes(properties.error_category)
      ? faultLimits
      : otherLimits;
    const fingerprint = toolFailureFingerprint(properties);
    const seen = reported.get(capability) ?? new Set<string>();
    if (seen.has(fingerprint) || seen.size >= perRun) return;
    const now = Date.now();
    // A clock that moved back never keeps the limit closed.
    const minute = (recent.get(context) ?? []).filter((time) => time <= now && time > now - 60_000);
    recent.set(context, minute);
    if (minute.length >= perMinute) return;
    minute.push(now);
    seen.add(fingerprint);
    reported.set(capability, seen);
    context.diagnostics.record('$exception', properties);
  } catch {
    // Diagnostics must never change a tool's result or error.
  }
};

/** A call the daemon gateway saw fail, under its reviewed MCP tool name only. */
export const recordGatewayFailure = (
  context: CrewContext,
  token: string,
  action: string,
  data: Record<string, unknown>,
  reason: ToolFailureReason,
) => {
  try {
    const capability = context.capabilities.get(token);
    const tool = reviewedToolName(action, data);
    if (capability && tool)
      recordToolFailure(context, capability, {
        error_source: 'tool_call',
        error_category: reason,
        error_tool: tool,
        error_boundary: 'gateway',
      });
  } catch {
    // Diagnostics must never change a tool's result or error.
  }
};
