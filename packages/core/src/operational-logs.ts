/** Rebuild the entire log from fixed vocabulary, dropping all additional input. */
export const sanitizeOperationalLog = (input: Record<string, unknown>): OperationalLog | null => {
  if (typeof input.code !== 'string' || !Object.hasOwn(operationalLogCodes, input.code))
    return null;
  const code = input.code as OperationalLogCode;
  const area = input.area;
  if (
    (code.startsWith('daemon_') && area === 'daemon') ||
    (code.startsWith('http_') && area === 'http') ||
    (code.startsWith('runtime_') && (area === 'chat' || area === 'workflow'))
  ) {
    const log: OperationalLog = {
      code,
      area,
      ...(area === 'http' ? sanitizeLogCorrelation(input) : {}),
    };
    if (failureCategories.includes(input.failure_category as never))
      log.failure_category = input.failure_category as FailureCategory;
    if ((area === 'chat' || area === 'workflow') && log.failure_category === 'process_exit') {
      if (
        Number.isInteger(input.runtime_exit_code) &&
        (input.runtime_exit_code as number) >= 0 &&
        (input.runtime_exit_code as number) <= 0xffff_ffff
      )
        log.runtime_exit_code = input.runtime_exit_code as number;
      if (exitSignals.includes(input.runtime_exit_signal as never))
        log.runtime_exit_signal = input.runtime_exit_signal as RuntimeExitSignal;
    }
    if (
      area === 'http' &&
      Number.isInteger(input.http_status) &&
      (input.http_status as number) >= 400 &&
      (input.http_status as number) <= 599
    )
      log.http_status = input.http_status as number;
    if (area === 'http' && httpOperations.includes(input.operation as never))
      log.operation = input.operation as HttpOperation;
    return log;
  }
  return null;
};
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
export interface OperationalLog extends LogCorrelation {
  code: OperationalLogCode;
  area: OperationalLogArea;
  failure_category?: FailureCategory;
  http_status?: number;
  runtime_exit_code?: number;
  runtime_exit_signal?: RuntimeExitSignal;
  operation?: HttpOperation;
}

export interface LogCorrelation {
  traceId?: string;
  spanId?: string;
  traceFlags?: number;
  sessionId?: string;
  posthogDistinctId?: string;
}

/** Only native anonymous SDK UUIDs and valid OTel context; never arbitrary identity/baggage. */
export const sanitizeLogCorrelation = (input: Record<string, unknown>): LogCorrelation => {
  const result: LogCorrelation = {};
  for (const key of ['sessionId', 'posthogDistinctId'] as const) {
    if (
      typeof input[key] === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input[key])
    )
      result[key] = input[key];
  }
  if (
    typeof input.traceId === 'string' &&
    /^[0-9a-f]{32}$/.test(input.traceId) &&
    !/^0+$/.test(input.traceId)
  ) {
    result.traceId = input.traceId;
    if (
      typeof input.spanId === 'string' &&
      /^[0-9a-f]{16}$/.test(input.spanId) &&
      !/^0+$/.test(input.spanId)
    )
      result.spanId = input.spanId;
    if (
      Number.isInteger(input.traceFlags) &&
      (input.traceFlags as number) >= 0 &&
      (input.traceFlags as number) <= 255
    )
      result.traceFlags = input.traceFlags as number;
  }
  return result;
};

// Fixed OS names only; never forward arbitrary error properties or CLI output.
const exitSignals = [
  'SIGABRT',
  'SIGBUS',
  'SIGFPE',
  'SIGHUP',
  'SIGILL',
  'SIGINT',
  'SIGKILL',
  'SIGPIPE',
  'SIGQUIT',
  'SIGSEGV',
  'SIGTERM',
  'SIGTRAP',
  'SIGSYS',
  'SIGXCPU',
  'SIGXFSZ',
] as const;
type RuntimeExitSignal = (typeof exitSignals)[number];

const httpOperations = ['packet_export_requested', 'packet_exported', 'workflow_started'] as const;
export type HttpOperation = (typeof httpOperations)[number];

const failureCategories = [
  'aborted',
  'timeout',
  'validation',
  'process_exit',
  'executable_missing',
  'other',
] as const;
export type FailureCategory = (typeof failureCategories)[number];

/** Classify locally; never export the exception, message, path, command or stderr. */
export const failureCategory = (error: unknown): FailureCategory => {
  if (!(error instanceof Error)) return 'other';
  const code = (error as NodeJS.ErrnoException).code;
  if (error.name === 'AbortError') return 'aborted';
  if (error.name === 'TimeoutError' || code === 'ETIMEDOUT') return 'timeout';
  if (
    error.name === 'ZodError' ||
    error.name === 'SyntaxError' ||
    code === 'PITCHCREW_RUNTIME_RESULT_INVALID'
  )
    return 'validation';
  if (code === 'ENOENT') return 'executable_missing';
  if (code === 'PITCHCREW_RUNTIME_EXIT') return 'process_exit';
  if (/^Runtime exited with code \d+\.$/.test(error.message)) return 'process_exit';
  return 'other';
};

/** Keep the original error local; rebuild only bounded, reviewed diagnostic fields. */
export const failureDetails = (error: unknown) => {
  const failure_category = failureCategory(error);
  const exit =
    error instanceof Error
      ? (error as Error & { exitCode?: unknown; signal?: unknown })
      : undefined;
  const log = sanitizeOperationalLog({
    code: 'runtime_run_failed',
    area: 'workflow',
    failure_category,
    runtime_exit_code: exit?.exitCode,
    runtime_exit_signal: exit?.signal,
  })!;
  return {
    failure_category,
    ...(log.runtime_exit_code !== undefined ? { runtime_exit_code: log.runtime_exit_code } : {}),
    ...(log.runtime_exit_signal ? { runtime_exit_signal: log.runtime_exit_signal } : {}),
  };
};
