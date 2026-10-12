import { afterEach, describe, expect, it, vi } from 'vitest';
import { reactErrorHandlers } from '../react-errors.ts';
import { reportErrorDiagnostic } from '../error-tracking.ts';

vi.mock('../error-tracking.ts', () => ({ reportErrorDiagnostic: vi.fn() }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('React error callbacks', () => {
  it('reports boundary errors without transmitting component information and retains local logging', () => {
    const error = new Error('private content');
    const logging = vi.spyOn(console, 'error').mockImplementation(() => {});
    reactErrorHandlers.onCaughtError?.(error, {
      componentStack: 'private path',
    });
    expect(reportErrorDiagnostic).toHaveBeenCalledExactlyOnceWith('react_boundary', error);
    expect(logging).toHaveBeenCalledExactlyOnceWith(error);
  });

  it('retains browser reporting of uncaught and recoverable root errors', () => {
    const original = vi.fn();
    vi.stubGlobal('reportError', original);
    const error = new Error('private');
    reactErrorHandlers.onUncaughtError?.(error, { componentStack: 'private path' });
    reactErrorHandlers.onRecoverableError?.(error, { componentStack: 'private path' });
    expect(vi.mocked(reportErrorDiagnostic).mock.calls.map(([source]) => source)).toEqual([
      'react_uncaught',
      'react_recoverable',
    ]);
    expect(original).toHaveBeenCalledTimes(2);
    expect(original).toHaveBeenCalledWith(error);
  });
});
