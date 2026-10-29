import type { DiagnosticSanitizer } from '@pitchcrew/core';
import { sanitizeAiObservation } from '@pitchcrew/core/telemetry-ai';
import { sanitizeLogObservation } from './logs.ts';
import { sanitizeMcpToolCall } from '@pitchcrew/core/telemetry-mcp';
import { sanitizeAgentProblem } from '@pitchcrew/core/telemetry-errors';

/** Static reviewed sanitizers; unknown events fail closed. */
export const sanitizeBackendObservation: DiagnosticSanitizer = (event, properties) =>
  sanitizeLogObservation(event, properties) ??
  sanitizeAiObservation(event, properties) ??
  (event === '$exception' ? sanitizeAgentProblem(properties) : null) ??
  (event === '$mcp_tool_call' ? sanitizeMcpToolCall(properties) : null);
