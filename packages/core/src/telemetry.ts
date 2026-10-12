/** Local correlation fields never become PostHog properties. */
export interface DiagnosticObservation {
  sequence: number;
  event: string;
  properties: Record<string, string | number | boolean>;
}

export interface TelemetryBatch {
  enabled: boolean;
  streamId: string;
  cursor: number;
  observations: DiagnosticObservation[];
}

export interface DiagnosticSink {
  record(event: string, properties: Record<string, unknown>): void;
}

export type DiagnosticSanitizer = (
  event: string,
  properties: Record<string, unknown>,
) => DiagnosticObservation['properties'] | null;
