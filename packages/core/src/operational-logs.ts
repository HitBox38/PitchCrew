/** Native OTLP log codes; never a sink for console output or user-supplied text. */
export const operationalLogCodes = {
  daemon_ready: { severity: 'INFO', number: 9, service: 'pitchcrew-daemon' },
  daemon_start_failed: { severity: 'ERROR', number: 17, service: 'pitchcrew-daemon' },
  daemon_run_recovered: { severity: 'WARN', number: 13, service: 'pitchcrew-daemon' },
  http_request_failed: { severity: 'WARN', number: 13, service: 'pitchcrew-http' },
  runtime_run_failed: { severity: 'ERROR', number: 17, service: 'pitchcrew-runtime' },
  runtime_run_cancelled: { severity: 'INFO', number: 9, service: 'pitchcrew-runtime' },
} as const;

export type OperationalLogCode = keyof typeof operationalLogCodes;
export type OperationalLogArea = 'daemon' | 'http' | 'chat' | 'workflow';
export interface OperationalLog {
  code: OperationalLogCode;
  area: OperationalLogArea;
}

/** Rebuild the entire log from fixed vocabulary, dropping all additional input. */
export function sanitizeOperationalLog(input: Record<string, unknown>): OperationalLog | null {
  if (typeof input.code !== 'string' || !Object.hasOwn(operationalLogCodes, input.code))
    return null;
  const code = input.code as OperationalLogCode;
  const area = input.area;
  if (
    (code.startsWith('daemon_') && area === 'daemon') ||
    (code.startsWith('http_') && area === 'http') ||
    (code.startsWith('runtime_') && (area === 'chat' || area === 'workflow'))
  )
    return { code, area };
  return null;
}
