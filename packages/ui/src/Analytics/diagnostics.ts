export type DiagnosticSanitizer = (
  properties: Record<string, unknown>,
) => Record<string, unknown> | null;

/** Static allowlist: feature sanitizers must rebuild properties from fixed enums and numbers.
 * Register reviewed feature modules here, never from SDK payloads or remote configuration.
 */
export const diagnosticSanitizers: Readonly<Record<string, DiagnosticSanitizer>> = Object.freeze(
  {},
);

export function sanitizeDiagnostic(event: string, properties: Record<string, unknown>) {
  if (!Object.hasOwn(diagnosticSanitizers, event)) return null;
  try {
    return diagnosticSanitizers[event](properties);
  } catch {
    return null;
  }
}
