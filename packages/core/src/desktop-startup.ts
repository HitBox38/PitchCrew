/** Numeric launch timings only; no native APIs or process identity reach the renderer. */
export interface DesktopStartupTiming {
  duration_ms: number;
  daemon_ready_ms: number;
}

export interface DesktopStartupBridge {
  getTiming(): Promise<DesktopStartupTiming | null>;
}
