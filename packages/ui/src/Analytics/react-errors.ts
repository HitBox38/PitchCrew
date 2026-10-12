import type { RootOptions } from 'react-dom/client';
import { reportErrorDiagnostic } from './error-tracking.ts';

function reportOriginal(error: unknown) {
  if (typeof globalThis.reportError === 'function') globalThis.reportError(error);
  else console.error(error);
}

/** React's callbacks report only a fixed category; the original error stays local. */
export const reactErrorHandlers: RootOptions = {
  onCaughtError(error) {
    reportErrorDiagnostic('react_boundary', error);
    console.error(error);
  },
  onUncaughtError(error) {
    reportErrorDiagnostic('react_uncaught', error);
    reportOriginal(error);
  },
  onRecoverableError(error) {
    reportErrorDiagnostic('react_recoverable', error);
    reportOriginal(error);
  },
};
