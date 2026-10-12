import type { DiagnosticSanitizer } from '@pitchcrew/core';
import { sanitizeAiObservation } from '@pitchcrew/core/telemetry-ai';
import { sanitizeLogObservation } from './logs.ts';

/** Static reviewed sanitizers; unknown events fail closed. */
export const sanitizeBackendObservation: DiagnosticSanitizer = (event, properties) =>
  sanitizeLogObservation(event, properties) ?? sanitizeAiObservation(event, properties);
