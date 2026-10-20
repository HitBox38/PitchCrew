export const sanitizeStartup = (input: Record<string, unknown>): Record<string, number> | null => {
  const { duration_ms, daemon_ready_ms } = input;
  if (
    typeof duration_ms !== 'number' ||
    !Number.isFinite(duration_ms) ||
    duration_ms < 0 ||
    duration_ms > 24 * 60 * 60 * 1000 ||
    typeof daemon_ready_ms !== 'number' ||
    !Number.isFinite(daemon_ready_ms) ||
    daemon_ready_ms < 0 ||
    daemon_ready_ms > duration_ms
  )
    return null;
  return { duration_ms: Math.round(duration_ms), daemon_ready_ms: Math.round(daemon_ready_ms) };
};
