/** Native-independent lifecycle logic, also exercised by deterministic desktop fixtures. */
export async function waitForMaintenance(deps: {
  busy: () => Promise<boolean>;
  show: (signal: AbortSignal, cancel: () => void) => void;
  wait: () => Promise<void>;
}): Promise<boolean> {
  if (!(await deps.busy())) return true;
  const controller = new AbortController();
  let cancelled = false;
  deps.show(controller.signal, () => {
    cancelled = true;
  });
  try {
    while (!cancelled) {
      await deps.wait();
      if (!(await deps.busy())) return true;
    }
    return false;
  } finally {
    controller.abort();
  }
}
