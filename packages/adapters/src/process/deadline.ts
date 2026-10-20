import type { RunContext } from '@pitchcrew/core';
import { runtimeTimeLimit } from './environment.ts';

/** Recheck a shared deadline at expiry so parent extensions reach already-running children. */
export const watchRuntimeDeadline = (
  context: Pick<RunContext, 'deadline'>,
  expired: () => void,
) => {
  if (!context.deadline) {
    const timer = setTimeout(expired, runtimeTimeLimit);
    return () => clearTimeout(timer);
  }
  const deadline = context.deadline;
  let timer: ReturnType<typeof setTimeout>;
  const check = () => {
    const remaining = deadline.expiresAt - Date.now();
    if (remaining <= 0) expired();
    else timer = setTimeout(check, Math.min(remaining, 2_147_483_647));
  };
  check();
  return () => clearTimeout(timer);
};
