import { sanitizeException } from './error-sanitizer.ts';
import { sanitizeRequestMetric, sanitizeRunMetric } from './metrics/sanitize.ts';
import { sanitizeAiSpan, sanitizeAiTrace } from '@pitchcrew/core/telemetry-ai';
import { sanitizeMcpToolCall } from '@pitchcrew/core/telemetry-mcp';
import { sanitizeStartup } from './startup/sanitize.ts';

export type DiagnosticSanitizer = (
  properties: Record<string, unknown>,
) => Record<string, unknown> | null;

/** Static allowlist: feature sanitizers must rebuild properties from fixed enums and numbers.
 * Register reviewed feature modules here, never from SDK payloads or remote configuration.
 */
export const diagnosticSanitizers: Readonly<Record<string, DiagnosticSanitizer>> = Object.freeze({
  $exception: sanitizeException,
  api_request_finished: sanitizeRequestMetric,
  run_finished: sanitizeRunMetric,
  app_startup_finished: sanitizeStartup,
  $ai_trace: sanitizeAiTrace,
  $ai_span: sanitizeAiSpan,
  $mcp_tool_call: sanitizeMcpToolCall,
});

export function sanitizeDiagnostic(event: string, properties: Record<string, unknown>) {
  if (!Object.hasOwn(diagnosticSanitizers, event)) return null;
  try {
    return diagnosticSanitizers[event](properties);
  } catch {
    return null;
  }
}
