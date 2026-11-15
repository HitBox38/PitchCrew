export const keepRemoteActionFocus = async (
  trigger: HTMLElement,
  destinationId: string,
  action: () => Promise<void>,
) => {
  const owned = document.activeElement === trigger;
  await action();
  if (!owned) return;
  requestAnimationFrame(() => {
    if (document.activeElement !== document.body && document.activeElement !== trigger) return;
    if (!trigger.isConnected)
      document.getElementById(destinationId)?.focus({ preventScroll: true });
    else if (trigger.matches(':disabled, [aria-disabled="true"]'))
      document.getElementById('remote-mcp-check')?.focus({ preventScroll: true });
  });
};
