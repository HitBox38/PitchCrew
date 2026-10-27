import { operationalLogCodes, type OperationalLog } from '@pitchcrew/core/operational-logs';

/** OTLP ExportLogsServiceRequest JSON. Only static bodies and reviewed attributes. */
export const operationalLogPayload = (
  log: OperationalLog,
  context: LogContext,
  distinctId: string,
  now: number,
) => {
  const definition = operationalLogCodes[log.code];
  const timeUnixNano = String(BigInt(Math.floor(now)) * 1_000_000n);
  // HTTP identity belongs to the originating request, never to the relay leader's tab.
  const identity = log.area === 'http' ? log.posthogDistinctId : distinctId;
  return {
    resourceLogs: [
      {
        resource: {
          attributes: [
            attribute('service.name', definition.service),
            attribute('service.version', context.app_version),
          ],
        },
        scopeLogs: [
          {
            scope: { name: 'pitchcrew.operational', version: '1' },
            logRecords: [
              {
                timeUnixNano,
                observedTimeUnixNano: timeUnixNano,
                ...(log.traceId
                  ? {
                      traceId: log.traceId,
                      ...(log.spanId ? { spanId: log.spanId } : {}),
                      flags: log.traceFlags ?? 0,
                    }
                  : {}),
                severityNumber: definition.number,
                severityText: definition.severity,
                body: { stringValue: log.code },
                attributes: [
                  attribute('code', log.code),
                  attribute('area', log.area),
                  ...(log.failure_category
                    ? [attribute('failure_category', log.failure_category)]
                    : []),
                  ...(log.http_status ? [attribute('http_status', log.http_status)] : []),
                  ...(log.runtime_exit_code !== undefined
                    ? [attribute('runtime_exit_code', log.runtime_exit_code)]
                    : []),
                  ...(log.runtime_exit_signal
                    ? [attribute('runtime_exit_signal', log.runtime_exit_signal)]
                    : []),
                  ...(log.operation ? [attribute('operation', log.operation)] : []),
                  attribute('renderer', context.renderer),
                  attribute('analytics_schema', context.analytics_schema),
                  ...(identity ? [attribute('posthogDistinctId', identity)] : []),
                  ...(log.sessionId ? [attribute('sessionId', log.sessionId)] : []),
                ],
              },
            ],
          },
        ],
      },
    ],
  };
};

export interface LogContext {
  app_version: string;
  renderer: 'browser' | 'electron';
  analytics_schema: number;
}

const attribute = (key: string, value: string | number) => ({
  key,
  value: typeof value === 'number' ? { intValue: String(value) } : { stringValue: value },
});
