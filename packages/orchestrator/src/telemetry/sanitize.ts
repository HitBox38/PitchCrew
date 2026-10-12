import type { DiagnosticSanitizer } from '@pitchcrew/core';
import { sanitizeLogObservation } from './logs.ts';

/** Feature-specific sanitizers are composed statically during integration. Unknown events fail closed. */
export const sanitizeBackendObservation: DiagnosticSanitizer = (event, properties) =>
  sanitizeLogObservation(event, properties);
