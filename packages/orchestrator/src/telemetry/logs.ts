import { sanitizeOperationalLog, type DiagnosticSink, type OperationalLog } from '@pitchcrew/core';

/** No raw Error values cross the observation boundary. Never affect application behavior. */
export const recordOperationalLog = (sink: DiagnosticSink | undefined, log: OperationalLog) => {
  try {
    const properties = sanitizeOperationalLog({ ...log });
    if (properties) sink?.record(operationalLogEvent, { ...properties });
  } catch {
    /* Diagnostics are best effort, even if a caller injects a failing sink. */
  }
};

export const sanitizeLogObservation = (event: string, input: Record<string, unknown>) => {
  if (event !== operationalLogEvent) return null;
  const log = sanitizeOperationalLog(input);
  return log ? { ...log } : null;
};

export const operationalLogEvent = 'operational_log';
