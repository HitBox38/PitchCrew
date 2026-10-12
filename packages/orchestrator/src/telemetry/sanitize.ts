import type { DiagnosticSanitizer } from '@pitchcrew/core';

/** Feature-specific sanitizers are composed statically during integration. Unknown events fail closed. */
export const sanitizeBackendObservation: DiagnosticSanitizer = () => null;
